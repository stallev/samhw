import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import logger from './logger.mjs';

const ssmClient = new SSMClient();

export const getGeoProviderCreds = async () => {
  try {
    const parameterName = process.env.GOOGLE_API_KEY_PARAM_NAME;

    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });

    const response = await ssmClient.send(command);
    const googleApiKey = response.Parameter.Value;

    const geoProviderCreds = {
      provider: 'google',
      apiKey: googleApiKey,
    };

    return {
      success: true,
      geoProviderCreds,
    };
  } catch (error) {
    console.error("Error fetching API Key:", error);

    logger.logFetchingApiKeysError({
      errorName: 'Error fetching Google API Key',
      error
    });

    return {
      success: false,
      body: JSON.stringify({ error: "Failed to fetch API Key" }),
    };
  }
};
