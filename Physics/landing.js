function goTo(course){
  event.stopPropagation();
  window.location.href = `course.html?course=${course}`;
}