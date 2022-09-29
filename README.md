# hapi Auth Plugin for AWS SNS
Plugin for [hapi](https://hapi.dev) to easily setup an [auth strategy](https://hapi.dev/api/?v=20.2.2#-serverauthstrategyname-scheme-options) that validates an [AWS SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html) payload using the [sns-payload-validator](https://www.npmjs.com/package/sns-payload-validator).

[![Coverage Status](https://coveralls.io/repos/github/devinstewart/hapi-auth-sns/badge.svg?branch=main)](https://coveralls.io/github/devinstewart/hapi-auth-sns?branch=main)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/devinstewart/hapi-auth-sns/ci.svg)](https://github.com/devinstewart/hapi-auth-sns/actions?query=workflow%3Aci+branch%3Amain)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=devinstewart_hapi-auth-sns&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=devinstewart_hapi-auth-sns)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=devinstewart_hapi-auth-sns&metric=security_rating)](https://sonarcloud.io/summary/overall?id=devinstewart_hapi-auth-sns)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=devinstewart_hapi-auth-sns&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=devinstewart_hapi-auth-sns)
## Installing
```bash
npm install --save hapi-auth-sns
```
**Please note:** While `SignatureVersion` 1 is the default, on 2022-09-19 [AWS announced](https://aws.amazon.com/blogs/security/sign-amazon-sns-messages-with-sha256-hashing-for-http-subscriptions/) the ability to set topics with `SignatureVersion` 2. Starting with version `1.1.0` of this plugin, `SignatureVersion` 1 and 2 are supported.

## Getting Started
```js
const Hapi = require('hapi');
const Sns = require('hapi-auth-sns');

const init = async () => {

    const server = Hapi.server({
        port: 3000,
        host: '0.0.0.0'
    });

    // Register the plugin
    await server.register(Sns);

    // Declare an authentication strategy using the sns scheme.
    server.auth.strategy('mySnsStrategy', 'sns');

    // Add a route that requires authentication.
    server.route({
        method: 'POST',
        path: '/',
        config: {
            auth: {
                strategy: 'mySnsStrategy',
                scope: 'myTopic' // optional
            },
        },
        handler: (request, h) => {

            // Make sure the message is a notification, not a subscription confirmation.
            if (request.payload.Type === 'Notification') {
                return `The message from myTopic is: ${request.payload.Message}`;
            }

            return 'This is a subscription confirmation message.';
        }

        await server.start();
        console.log('Server running on %s', server.info.uri);
    });
};

init();
```

## Scopes
The scope in the credentials is set to the topic name, derived from the `TopicArn` in the payload.

To limit the route to a single topic, set the `scope` option to the topic name:
```js
auth: {
    strategy: 'mySnsStrategy',
    scope: 'myTopic'
}
```

To allow multiple topics, set the `scope` option to an array of topic names:
```js
auth: {
    strategy: 'mySnsStrategy',
    scope: ['myTopic1', 'myTopic2']
}
```

To allow all topics, omit the `scope` option:
```js
auth: {
    strategy: 'mySnsStrategy'
}
```

## Options
There are two options available for the sns strategy:
- `autoSubscribe` - A message type of `SubscriptionConfirmation` automatically subscribes the route to the topic after validation, default `true`.
- `autoResubscribe` - A message type of `UnsubscribeConfirmation` automatically resubscribes the route to the topic after validation, default `true`.

Either one or both can be disabled when declaring the strategy:
```js
server.auth.strategy('mySnsStrategy', 'sns', {
    autoSubscribe: false,
    autoResubscribe: false
});
```

## Additional Information
The `request.payload` will have the following properties:
- `Type` - The message type: `Notification`, `SubscriptionConfirmation` or `UnsubscribeConfirmation`.
- `MessageId` - A uuid provided by the SNS service for each message.
- `Token` - The token that must be passed to the `SubscribeURL` to confirm the subscription when the message type is `SubscriptionConfirmation` or `UnsubscribeConfirmation`.
- `TopicArn` - The ARN of the topic the message was sent from.
- `Subject` - The subject of the message when the message type is `Notification`. This is not present if a Subject was not provided when the message was published.
- `Message` - The message body when the message type is `Notification`.
- `Timestamp` - The time the message was sent.
- `SignatureVersion` - The version of the signature algorithm used to sign the message. Defaults to `1`, can also be `2`.
- `Signature` - The signature of the message used to verify the message integrity.
- `SigningCertURL` - The URL of the certificate used to sign the message.
- `SubscribeURL` - The URL used to subscribe the route when the message type is `SubscriptionConfirmation` or `UnsubscribeConfirmation`.
- `UnsubscribeURL` - The URL used to unsubscribe the route when the message type is `Notification`.

Due to how payload validation works, `request.auth.credentials.sns` will be set to `true` if payload is valid.  However, it is not used by the plugin.

## Acknowledgements
The format of the code was adapted from the [@hapi/jwt](https://www.npmjs.com/package/@hapi/jwt) module, [BSD-3-Clause](https://github.com/hapijs/jwt/blob/master/LICENSE.md), which is maintained by the fine folks in the [hapijs community](https://github.com/hapijs).