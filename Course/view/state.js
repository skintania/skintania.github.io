export const state = {
  courseId:      new URLSearchParams(location.search).get('id'),
  currentUser:   null,
  activeClipKey: null,
};
