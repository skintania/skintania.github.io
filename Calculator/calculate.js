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
    // Calculation: score = sum(grade * weight)
    // ---------------------------------------------------------

    const departElement = document.getElementById('depart');
    const departCode = departElement?.getAttribute('data-value')?.trim();

    if (!departCode) {
        alert('กรุณาเลือกภาคก่อนคำนวณ');
        return;
    }

    fetch('weight.json')
        .then(res => {
            if (!res.ok) throw new Error('ไม่สามารถโหลดไฟล์น้ำหนักได้');
            return res.json();
        })
        .then(weightData => {
            const weights = weightData[departCode];
            if (!weights) throw new Error(`ไม่พบข้อมูลน้ำหนักสำหรับภาค "${departCode}"`);

            let totalWeight = 0;
            let weightedScore = 0;

            gradesData.forEach(({ subject, grade }) => {
                const weight = weights[subject];
                if (typeof weight === 'number') {
                    totalWeight += weight;
                    weightedScore += grade * weight;
                } else {
                    console.warn('No weight for subject', subject, 'in dept', departCode);
                }
            });

            const gpax = totalWeight > 0 ? weightedScore / totalWeight : 0;
            const percent = totalWeight > 0 ? (weightedScore / (totalWeight * 4)) * 100 : 0;

            const chanceTextEl = document.querySelector('.chance-text');
            const circleEl = document.querySelector('.chance-circle');
            const scoreTextEls = document.querySelectorAll('.score-text');
            const statusEl = document.querySelector('.status-message');

            if (chanceTextEl) chanceTextEl.innerText = `${percent.toFixed(2)} %`;
            if (circleEl) circleEl.style.setProperty('--percentage', `${percent.toFixed(2)}%`);

            // Update GPAX and raw score display
            if (scoreTextEls.length >= 2) {
                scoreTextEls[0].innerText = `GPAX: ${gpax.toFixed(2)}`;
                scoreTextEls[1].innerText = `Score: ${weightedScore.toFixed(1)} / ${(totalWeight * 4).toFixed(1)}`;
            } else if (scoreTextEls.length === 1) {
                scoreTextEls[0].innerText = `GPAX: ${gpax.toFixed(2)} | Score: ${weightedScore.toFixed(1)} / ${(totalWeight * 4).toFixed(1)}`;
            }

            if (statusEl) {
                let message = "Let's try again next year";
                let statusClass = 'error';
                if (percent >= 90) {
                    message = 'Excellent — you are on track!';
                    statusClass = 'success';
                } else if (percent >= 70) {
                    message = 'Good job — keep it up!';
                    statusClass = 'warning';
                } else if (percent >= 50) {
                    message = 'Almost there — keep going!';
                    statusClass = 'warning';
                }

                statusEl.classList.remove('error', 'warning', 'success');
                statusEl.classList.add(statusClass);
                statusEl.innerText = message;
            }
        })
        .catch(err => {
            console.error(err);
            alert('เกิดข้อผิดพลาด: ' + err.message);
        });

});