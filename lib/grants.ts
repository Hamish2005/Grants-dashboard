import { db, transaction } from "./db";
import { createGrantService } from "./grant-service";
export { id, now } from "./grant-service";
export const {
  audit,
  getGrant,
  referenceData,
  listGrants,
  createGrant,
  updateGrant,
  editable,
  archiveGrant,
  updateStage,
  advanceGrant,
  addComment,
  setHold,
  pauseCycle,
} = createGrantService(db, transaction);
