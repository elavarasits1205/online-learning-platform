
import api from "./Api";

const instructorApi = {
  // Courses
  getMyCourses: () => api.get("/courses/my"),
  getCourse: (id) => api.get(`/courses/${id}`),
  createCourse: (course) => api.post("/courses", course),
  updateCourse: (id, course) =>
    api.put(`/courses/${id}`, course),
  submitCourse: (id) =>
    api.post(`/courses/${id}/submit`),

  // Instructor profile
  getMyProfile: () => api.get("/instructors/me"),
  updateMyProfile: (profile) =>
    api.put("/instructors/me", profile),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/instructors/me/profile-image", formData);
  },

  // Modules
  getModules: (courseId) =>
    api.get(`/modules/course/${courseId}`),
  createModule: (module) =>
    api.post("/modules", module),
  updateModule: (id, module) =>
    api.put(`/modules/${id}`, module),

  // Lessons
  getLessons: (moduleId) =>
    api.get(`/lessons/module/${moduleId}`),
  createLesson: (lesson) =>
    api.post("/lessons", lesson),

  // Upload lesson video




  
uploadLessonVideo: (moduleId, file) => {
  const formData = new FormData();
  formData.append("video", file);

  return api.post(
    `/lessons/module/${moduleId}/video`,
    formData
  );
},


  // Categories
  getCategories: () =>
    api.get("/courses/categories"),

  // Course thumbnail
  uploadThumbnail: (courseId, file) => {
  const formData = new FormData();
  formData.append("thumbnail", file);

  return api.post(
    `/courses/${courseId}/thumbnail`,
    formData
  );
},
};

export { instructorApi };
export default instructorApi;
