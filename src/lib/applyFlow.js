import { apiStageExtensionSession } from "./api";
import { getUserId } from "./auth";

export const getApplyLink = (item = {}) =>
  item.apply_link ||
  item.source_url ||
  item.link ||
  item.external_apply_url ||
  item.opportunity?.external_apply_url ||
  item.opportunity?.link ||
  "";

export const stageExtensionContext = ({ opportunity_id, external_url }) => {
  window.postMessage({
    source: "fundme-web",
    type: "FUNDME_STASH_SESSION",
    user_id: getUserId(),
    opportunity_id,
    baseUrl: window.location.origin,
  }, "*");

  return apiStageExtensionSession({ opportunity_id, external_url });
};
