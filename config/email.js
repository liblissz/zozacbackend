import SibApiV3Sdk from 'sib-api-v3-sdk';

export const createEmailApi = () => {
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    return new SibApiV3Sdk.TransactionalEmailsApi();
};
