import type { CustomizationState } from "@/lib/agent-behavior";
import type { InstallationProfile } from "@/lib/bmad-installation";
import type { WorkflowGraph } from "@/lib/workflow-graph";
export type Agent = {
  id: string;
  slug: string;
  name: string;
  title: string;
  icon: string;
  description: string | null;
  persona: unknown;
  customization: CustomizationState;
  skillName: string | null;
  source: string;
  scope: string;
  available: boolean;
  connectionId: string | null;
  modelId: string | null;
};
export type Skill = {
  id: string;
  name: string;
  description: string | null;
  directory: string;
  source: string;
  isManaged: boolean;
  customizeSchema: string | null;
};
export type Operation = {
  id: string;
  kind: string;
  status: string;
  preview: unknown;
  payload: unknown;
  error: string | null;
  output: string | null;
  createdAt: string | Date;
};
export type StudioData = {
  installation: InstallationProfile;
  workerOnline: boolean;
  runtime: {
    id: string;
    workflow: WorkflowGraph | unknown;
    connectionId: string | null;
    modelId: string | null;
    installedVersion: string | null;
    installStatus: string;
  };
  agents: Agent[];
  skills: Skill[];
  operations: Operation[];
  conversations: {
    id: string;
    agentId: string | null;
    title: string;
    messages: { role: string; content: string; status: string }[];
  }[];
};
