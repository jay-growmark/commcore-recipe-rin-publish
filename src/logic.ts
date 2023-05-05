import { Athena } from 'aws-sdk';
import { GetQueryResultsOutput } from 'aws-sdk/clients/athena';
import withMiddleware from '@growmark/lambda-middleware/core';
import { logging } from '@growmark/lambda-middleware/middleware/logging';
import hb from 'handlebars';
import { Execution } from '@growmark/commcore/types';
import sendMessage, { commcore_recipe } from '@growmark/commcore';
import sql from './query.sql';
import { format } from 'sqlstring';
import emailtemplate from './template.email.hbs';
import smstemplate from './template.sms.hbs';

type DataRow = {
  structure_property_a: string;
  structure_property_b: string;
};
const extractDataFromAthenaResults = (row: GetQueryResultsOutput['ResultSet']['Rows'][0]) : DataRow => ({
  structure_property_a: row?.Data?.[0]?.VarCharValue,
  structure_property_b: row?.Data?.[1]?.VarCharValue,
});

//export const handler will produce a similar "exports.handler = handler"
export const handler = withMiddleware([ commcore_recipe, logging ])(async (event: Execution) => {
  //extract criteria
  const { criteria, timeframe, recipients } = event || {};
  const qualifier = criteria
    .filter(c => c.name === 'By A Known Qualifier')
    .map(c => c.value)
    .filter(exists => exists);

  //inidial validations
  if(!criteria || !timeframe || !recipients) throw 'missing criteria';

  //build sql
  const predicate = format(`and 'a' = ?`, qualifier); //predicate that will constrain the query
  const QueryString = sql
    .replace('/* {some predicate} */', predicate);

  //query data
  const engine = new Athena({ apiVersion: '2017-05-18' });
  const exec = await engine.startQueryExecution({ QueryString, WorkGroup: 'commcore' }).promise();
  console.log('query execution', exec.QueryExecutionId);
  let status = await engine.getQueryExecution({ QueryExecutionId: exec.QueryExecutionId }).promise();
  while(status.QueryExecution?.Status?.State === "RUNNING" || status.QueryExecution?.Status?.State === "QUEUED"){
    console.log('still executing, waiting 500ms', exec.QueryExecutionId);
    await new Promise(resolve => setTimeout(resolve, 500)); //TODO: maybe find a good way to avoid running lambda while stuff is running.
    status = await engine.getQueryExecution({ QueryExecutionId: exec.QueryExecutionId }).promise();
  }

  //results validation
  const queryWasSuccessful = status.QueryExecution?.Status?.State === "SUCCEEDED";
  if(!queryWasSuccessful){
    console.warn('failed query status', status.QueryExecution?.Status);
    throw 'failed athena query';
  }

  //get results
  const data: Array<DataRow> = [];
  let results = await engine.getQueryResults({ QueryExecutionId: exec.QueryExecutionId, MaxResults: 1000 }).promise();
  const [header, ...initialrows] = (results.ResultSet?.Rows || []);
  initialrows
    .map(extractDataFromAthenaResults)
    .forEach(r => data.push(r));
  while(results.NextToken){
    await new Promise(resolve => setTimeout(resolve, 100));
    results = await engine.getQueryResults({ QueryExecutionId: exec.QueryExecutionId, NextToken: results.NextToken }).promise();
    (results.ResultSet?.Rows || [])
      .map(extractDataFromAthenaResults)
      .forEach(r => data.push(r));
  }

  //exit early if no records exist
  if(!data?.length) return 'EMTPY SUCCESS';

  //build message for user
  const subject = `Test Example Subject`;
  const email = hb.compile(emailtemplate)(data);
  const sms = hb.compile(smstemplate)(data);

  //queue the message for sending
  for(const recipient of recipients){
    switch(recipient.method){
      case "EMAIL": await sendMessage(recipient.value, subject, email); break;
      case "SMS": await sendMessage(recipient.value, subject, sms); break;
    }
  }

  //return successful information
  return "SUCCESS";
});