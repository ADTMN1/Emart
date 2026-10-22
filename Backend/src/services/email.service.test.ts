import assert from 'node:assert/strict';
import test from 'node:test';

import { EmailService, EmailServiceOptions, SELLER_APPROVAL_SUBJECT } from './email.service';

const OPTS: EmailServiceOptions = {
  apiKey: 'xkeysib-dummy-test-key',
  from: 'no-reply@emart.com',
  fromName: 'Marcari23',
  frontendUrl: 'http://localhost:5173',
};

function makeClient(impl?: (input: any) => any) {
  const calls: any[] = [];
  const client = {
    async send(input: any) {
      calls.push(input);
      return impl ? impl(input) : { status: 201, messageId: 'brevo-msg-id-123' };
    },
  };
  return { client, calls };
}

test('send: returns the message id and a clean success result', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService(OPTS, client as any);
  const result = await service.send({
    to: 'seller@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi',
  });
  assert.equal(result.sent, true);
  assert.equal(result.messageId, 'brevo-msg-id-123');
  assert.equal(result.error, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, 'seller@example.com');
  assert.equal(calls[0].from, 'no-reply@emart.com');
  assert.equal(calls[0].fromName, 'Marcari23');
  assert.equal(calls[0].subject, 'Hello');
  assert.ok(calls[0].html.includes('<p>Hi</p>'));
  assert.ok(calls[0].text === 'Hi');
});

test('send: surfaces a Brevo failure (thrown HTTP error) without throwing', async () => {
  const { client } = makeClient(() => {
    throw Object.assign(new Error('Request failed with status code 402'), {
      response: { status: 402 },
    });
  });
  const service = new EmailService(OPTS, client as any);
  const result = await service.send({
    to: 'seller@example.com',
    subject: 'Hi',
    html: '<p>Hi</p>',
    text: 'Hi',
  });
  assert.equal(result.sent, false);
  assert.equal(result.error, 'Request failed with status code 402');
});

test('send: reports skipped when Brevo is not configured', async () => {
  const service = new EmailService({ ...OPTS, apiKey: '' }, {} as any);
  const result = await service.send({
    to: 'seller@example.com',
    subject: 'Hi',
    html: '<p>Hi</p>',
    text: 'Hi',
  });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'email-not-configured');
});

test('send: reports skipped when the recipient is empty', async () => {
  const { client } = makeClient();
  const service = new EmailService(OPTS, client as any);
  const result = await service.send({ to: '   ', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'missing-recipient');
});

test('sendSellerApprovalEmail: builds branded HTML + plain-text with the configured dashboard URL', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService(OPTS, client as any);
  const result = await service.sendSellerApprovalEmail({
    to: 'seller@example.com',
    applicantName: 'Nati',
    storeName: 'Nati Tech Deals',
  });
  assert.equal(result.sent, true);
  assert.equal(calls[0].subject, SELLER_APPROVAL_SUBJECT);
  assert.equal(calls[0].to, 'seller@example.com');
  assert.ok(calls[0].html.includes('Marcari23'));
  assert.ok(calls[0].html.includes('Go to Seller Dashboard'));
  assert.ok(calls[0].html.includes('http://localhost:5173/seller'));
  assert.ok(calls[0].text.includes('http://localhost:5173/seller'));
  assert.ok(calls[0].html.includes('Nati Tech Deals'));
  assert.ok(calls[0].html.includes('Congratulations, Nati!'));
});

test('sendSellerApprovalEmail: dashboard URL follows the configured frontendUrl', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService(
    { ...OPTS, frontendUrl: 'https://emart-five-taupe.vercel.app/' },
    client as any,
  );
  await service.sendSellerApprovalEmail({ to: 'seller@example.com', storeName: 'Store' });
  assert.ok(calls[0].html.includes('https://emart-five-taupe.vercel.app/seller'));
});

test('sendSellerApprovalEmail: escapes user-controlled values in the HTML', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService(OPTS, client as any);
  await service.sendSellerApprovalEmail({
    to: 'seller@example.com',
    applicantName: '<img src=x onerror=alert(1)>',
    storeName: 'A&B "Quoted"',
  });
  assert.ok(!calls[0].html.includes('<img'));
  assert.ok(calls[0].html.includes('&lt;img'));
  assert.ok(calls[0].html.includes('A&amp;B'));
});

test('sendSellerApprovalEmail: a non-http frontendUrl falls back to localhost (no open redirect)', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService({ ...OPTS, frontendUrl: 'javascript:alert(1)' }, client as any);
  await service.sendSellerApprovalEmail({ to: 'seller@example.com' });
  assert.ok(calls[0].html.includes('http://localhost:5173/seller'));
  assert.ok(!calls[0].html.includes('javascript:'));
});

test('sendSellerApprovalEmail: the API key never appears in content', async () => {
  const { client, calls } = makeClient();
  const service = new EmailService(OPTS, client as any);
  await service.sendSellerApprovalEmail({ to: 'seller@example.com', storeName: 'Store' });
  assert.ok(!calls[0].html.includes('xkeysib-dummy-test-key'));
  assert.ok(!calls[0].text.includes('xkeysib-dummy-test-key'));
});