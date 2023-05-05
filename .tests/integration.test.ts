import { handler } from '../src/logic';
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import sinon from 'sinon';
import { Execution } from '@growmark/commcore/types';

const sandbox = sinon.createSandbox();
beforeEach(() => {
  AWSMock.setSDKInstance(AWS);
  AWSMock.mock('SQS', 'deleteMessage', async () => ({}));
  AWSMock.mock('SQS', 'getQueueUrl', async () => ({ QueueUrl: 'https://jest.growmark.com/sqs/url' }));
  AWSMock.mock('SQS', 'sendMessage', async () => ({}));
  
  sandbox.stub(console, 'info');
  sandbox.stub(console, 'log');
  sandbox.stub(console, 'debug');
  sandbox.stub(console, 'warn');
});
afterEach(() => {
  AWSMock.restore();
  sandbox.restore();
});

const event: Execution = {
  resource: "a9953304-c41c-438c-a696-2fd5ed17c320",
  name: "Example Test",
  description: "Some test example",
  criteria: [
    {
      name: "By A Known Qualifier",
      value: "a",
      display: "Some Input by the User"
    }
  ],
  period: "HOURLY",
  recipients: [
    {
      method: "EMAIL",
      value: "atuttle@growmark.com"
    }
  ],
  active: true,
  recipe: "ORDER_CREATE",
  timeframe: [
    new Date("2022-10-07T00:00:00.000Z"),
    new Date("2022-10-07T01:00:00.000Z")
  ]
};

test('test run recipe', async () => {
  const response = await handler(event, {} as any);
  expect(response).toBe("SUCCESS");
});