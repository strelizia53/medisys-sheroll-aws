// src/components/ConfigureAmplifyClientSide.tsx
"use client";

import { Amplify } from "aws-amplify";
import awsConfig from "../app/aws-exports";

Amplify.configure(awsConfig, { ssr: true }); // ← no any, ESLint happy

export default function ConfigureAmplifyClientSide() {
  return null;
}
