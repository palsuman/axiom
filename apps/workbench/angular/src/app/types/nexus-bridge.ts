export interface AngularWorkbenchEnvSnapshot {
  env: string;
  platform: string;
}

export interface AngularWorkbenchBridge {
  getEnv(): Promise<AngularWorkbenchEnvSnapshot>;
}
