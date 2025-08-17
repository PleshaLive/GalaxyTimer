// public/js/timerControl.js

export function initTimerControls() {
    console.log("[TimerControl] Initializing timer controls...");

    const modeRadios = document.querySelectorAll('input[name="timerMode"]'); // Убедитесь, что имя совпадает с HTML
    const durationInputs = document.getElementById('timerDurationInputs');
    const targetInputs = document.getElementById('timerTargetInputs');
    const messageDiv = document.getElementById('timerMessage');
    const setTimerButton = document.getElementById('setTimerButton');

    if (!setTimerButton || !durationInputs || !targetInputs || !messageDiv || modeRadios.length === 0) {
        console.warn("[TimerControl] One or more timer control elements are missing from the DOM.");
        return;
    }

    modeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'duration') {
                durationInputs.style.display = 'block';
                targetInputs.style.display = 'none';
            } else {
                durationInputs.style.display = 'none';
                targetInputs.style.display = 'block';
            }
            messageDiv.textContent = '';
        });
    });

    setTimerButton.addEventListener('click', function() {
        const mode = document.querySelector('input[name="timerMode"]:checked').value;
        let targetTimeValue; // Используем targetTimeValue для ясности, что это timestamp

        if (mode === 'duration') {
            const hours = parseInt(document.getElementById('timerHoursInput').value, 10) || 0;
            const minutes = parseInt(document.getElementById('timerMinutesInput').value, 10) || 0;
            const seconds = parseInt(document.getElementById('timerSecondsInput').value, 10) || 0;
            const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
            if (totalMs <= 0) {
                alert("Введите положительное время!");
                return;
            }
            targetTimeValue = Date.now() + totalMs;
        } else if (mode === 'target') {
            const targetHours = parseInt(document.getElementById('timerTargetHoursInput').value, 10);
            const targetMinutes = parseInt(document.getElementById('timerTargetMinutesInput').value, 10);
            
            if (isNaN(targetHours) || isNaN(targetMinutes) || targetHours < 0 || targetHours > 23 || targetMinutes < 0 || targetMinutes > 59) {
                alert("Введите корректное целевое время!");
                return;
            }

            const now = new Date();
            let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHours, targetMinutes, 0);
            
            if (targetDate.getTime() <= now.getTime()) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            targetTimeValue = targetDate.getTime();
        }

        // Отправляем targetTimeValue на сервер
        // Используем глобальную функцию saveData, если она доступна и адаптирована,
        // или прямой fetch, как в оригинале. Для простоты оставим fetch.
        fetch('/timer', { // URL относительно корня сайта Код2
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetTime: targetTimeValue }) // Убедимся, что сервер ожидает { targetTime: ... }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                messageDiv.textContent = 'Таймер обновлён!';
                console.log('[TimerControl] Timer updated successfully via POST /timer');
                setTimeout(() => { messageDiv.textContent = ''; }, 3000);
            } else {
                alert('Ошибка обновления таймера: ' + (data.error || 'Неизвестная ошибка'));
                console.error('[TimerControl] Error updating timer:', data.error);
            }
        })
        .catch(err => {
            console.error('[TimerControl] Error connecting to server or processing request:', err);
            alert('Ошибка соединения с сервером: ' + err.message);
        });
    });
    console.log("[TimerControl] Timer controls initialized.");
}