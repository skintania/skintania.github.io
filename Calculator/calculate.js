document.getElementById('calbutton').addEventListener('click', function() {
    
    const gradesData = [];

    const cards = document.querySelectorAll('article.card');

    cards.forEach(card => {
        
        const subjectName = card.querySelector('h2').innerText;

        const selectedGradeDiv = card.querySelector('.selected-option');

        if (selectedGradeDiv) {
            const gradeValue = parseFloat(selectedGradeDiv.getAttribute('data-value'));
            gradesData.push({
                subject: subjectName,
                grade: gradeValue
            });
        }
    });

    console.log("Extracted Grades:", gradesData);
    
    // ---------------------------------------------------------
    // YOUR CALCULATION CODE GOES HERE
    // ---------------------------------------------------------

});