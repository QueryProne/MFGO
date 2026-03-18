import { registerCommunicationProvider } from "../provider";
import { MockCommunicationProvider } from "./mock-provider";

let initialized = false;

export function ensureCommunicationProvidersRegistered(): void {
  if (initialized) {
    return;
  }

  registerCommunicationProvider(new MockCommunicationProvider());
  initialized = true;
}
