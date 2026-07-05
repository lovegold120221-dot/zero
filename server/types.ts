export interface TaskRequest {
  type: string;
  label: string;
  prompt?: string;
  userRequest?: string;
  userEmail?: string;
  userId?: string;
}

export interface TaskStep {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'done';
}

export interface TaskFile {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface TaskOutput {
  type: string;
  title: string;
  content: string;
  fileType: string;
}

export interface SandboxTask {
  id: string;
  type: string;
  label: string;
  status: 'understanding' | 'preparing' | 'working' | 'reviewing' | 'done' | 'error';
  steps: TaskStep[];
  files: TaskFile[];
  output: TaskOutput | null;
  error: string | null;
  createdAt: number;
  userEmail?: string;
  userId?: string;
}

export interface TaskStatusResponse {
  taskId: string;
  status: string;
  type: string;
  label: string;
  steps: TaskStep[];
  previewUrl: string | null;
  downloadUrl: string | null;
  files: TaskFile[];
  error: string | null;
  output: TaskOutput | null;
  userEmail?: string;
  userId?: string;
}
