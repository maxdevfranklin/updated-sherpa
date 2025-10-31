export interface FunctionCallResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

export interface FunctionArgs {
  [key: string]: any;
}

export interface FunctionResult {
  [key: string]: any;
  error?: string;
}
