/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

import { fetchVolunteerOpportunities } from './utils/api.mjs';

export const lambdaHandler = async (event, context) => {
    const initLocation = '93721';
    try {
        const { opportunities } = await fetchVolunteerOpportunities(initLocation);

        return {
            'statusCode': 200,
            'body': JSON.stringify({
                message: 'hello world',
                opportunitiesLength: opportunities?.length,
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }
};
