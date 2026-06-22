// Admin auth + content mutations, delegated to the build-selected backend.
export {
  getSession,
  signIn,
  signOut,
  setTestimonialStatus,
  updateTestimonial,
  updatePerson,
  deleteTestimonial,
  setTestimonialTags,
  fetchAllComments,
  setCommentStatus,
  deleteComment,
  addFilterOption,
  deleteFilterOption,
  upsertSetting,
} from '@backend';
