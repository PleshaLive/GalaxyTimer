// public/js/auth.js

// Проверка аутентификации (используем localStorage)
if (localStorage.getItem('isLoggedIn') !== 'true') {
    // Если пользователь не вошел, перенаправляем на страницу входа
    window.location.href = 'login.html'; 
} else {
    console.log('Пользователь авторизован (localStorage). Загрузка index.html разрешена.');
}