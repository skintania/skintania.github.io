// Function to load and render courses from JSON
async function loadCourses() {
  console.log('Starting to load courses...');
  try {
    const response = await fetch('/Course/Course.json');
    console.log('Fetch response:', response);
    const courses = await response.json();
    console.log('Courses loaded:', courses);
    const grid = document.getElementById('coursesGrid');
    
    // Clear any existing content
    grid.innerHTML = '';
    
    // The default SVG icon (Video Filmstrip)
    const defaultIcon = `
      <div class="default-thumb">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
      </div>
    `;

    courses.forEach(course => {
      const article = document.createElement('article');
      article.className = 'card';
      
      // Step 1: Check if thumbnail exists in JSON
      const thumbnailHTML = course.thumbnail 
        ? `<img src="${course.thumbnail}" alt="${course.title}" class="card-thumb">`
        : defaultIcon;

      article.innerHTML = `
        ${thumbnailHTML}
        <div class="card-content">
          <h2>${course.title}</h2>
          <p>${course.description}</p>
          <a class="btn" href="${course.link}">${course.linkText}</a>
        </div>
      `;
      
      // Step 2: Handle broken images (if it exists in JSON but fails to load)
      if (course.thumbnail) {
        const img = article.querySelector('.card-thumb');
        if (img) {
          img.onerror = () => {
            // Replaces the broken <img> tag with the default icon HTML
            img.outerHTML = defaultIcon; 
          };
        }
      }

      grid.appendChild(article);
    });
    console.log('Courses rendered.');
  } catch (error) {
    console.error('Error loading courses:', error);
    document.getElementById('coursesGrid').innerHTML = '<p>Unable to load courses. Please try again later.</p>';
  }
}

window.addEventListener('DOMContentLoaded', loadCourses);