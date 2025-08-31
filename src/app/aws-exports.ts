import type { ResourcesConfig } from "aws-amplify";

const awsConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: "ap-south-1_tqlPMkUto",
      // ⬇️ Paste your PUBLIC (no secret) App client ID here
      userPoolClientId: "7n2aqqktsdesjcocotv4o71c64",

      // Hosted UI / OAuth settings
      loginWith: {
        oauth: {
          // ⬇️ Confirm this EXACT domain in Cognito Console (App integration > Domain name)
          domain: "ap-south-1tqlpmkuto.auth.ap-south-1.amazoncognito.com",
          scopes: ["openid", "email", "profile"],
          // Keep both local and prod so either works
          redirectSignIn: [
            "http://localhost:3000/",
            "https://d84l1y8p4kdic.cloudfront.net/",
          ],
          redirectSignOut: [
            "http://localhost:3000/",
            "https://d84l1y8p4kdic.cloudfront.net/",
          ],
          responseType: "code",
        },
      },
    },
  },
};

export default awsConfig;
