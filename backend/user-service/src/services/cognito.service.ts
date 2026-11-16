import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";
import { envConfig } from "../config/env.config";
import { createLogger } from "@ecoalert/shared";

const logger = createLogger("user-service:cognito");

export class CognitoService {
  private client: CognitoIdentityProviderClient;
  private clientId: string;
  private clientSecret: string;
  private userPoolId: string;

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: envConfig.cognito.region,
    });
    this.clientId = envConfig.cognito.clientId;
    this.clientSecret = envConfig.cognito.clientSecret;
    this.userPoolId = envConfig.cognito.userPoolId;
    logger.info("CognitoService initialized for region: " + envConfig.cognito.region);
  }

  calculateSecretHash(username: string): string {
    if (!this.clientSecret) return "";
    return crypto
      .createHmac("sha256", this.clientSecret)
      .update(username + this.clientId)
      .digest("base64");
  }

  async signUp(email: string, password: string, fullName: string) {
    const secretHash = this.calculateSecretHash(email);
    const command = new SignUpCommand({
      ClientId: this.clientId,
      SecretHash: secretHash || undefined,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: fullName || email.split("@")[0] },
      ],
    });
    return this.client.send(command);
  }

  async confirmSignUp(email: string, code: string) {
    const secretHash = this.calculateSecretHash(email);
    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      SecretHash: secretHash || undefined,
      Username: email,
      ConfirmationCode: code,
    });
    return this.client.send(command);
  }

  async resendConfirmationCode(email: string) {
    const secretHash = this.calculateSecretHash(email);
    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      SecretHash: secretHash || undefined,
      Username: email,
    });
    return this.client.send(command);
  }

  async login(email: string, password: string) {
    const secretHash = this.calculateSecretHash(email);
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash,
      },
    });
    return this.client.send(command);
  }
}

export const cognitoService = new CognitoService();
