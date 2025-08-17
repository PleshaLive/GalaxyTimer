// public/js/api.js

/**
 * Отправляет данные на сервер указанным методом.
 * @param {string} url - URL эндпоинта API.
 * @param {object} data - Данные для отправки.
 * @param {string} [method='POST'] - HTTP метод (POST, PUT, etc.).
 * @returns {Promise<object>} - Promise с ответом сервера в формате JSON или объектом успеха.
 * @throws {Error} - Выбрасывает ошибку в случае неудачного запроса или ошибки сети.
 */
export async function saveData(url, data, method = 'POST') {
  // Логируем начало запроса
  console.log(`[API] Sending ${method} request to ${url} with data:`, data);
  try {
    // Выполняем асинхронный запрос fetch
    const response = await fetch(url, {
      method: method, // Используем указанный HTTP метод
      headers: {
        "Content-Type": "application/json" // Указываем, что отправляем JSON
      },
      body: JSON.stringify(data) // Преобразуем объект данных в JSON строку
    });

    // Проверяем статус HTTP ответа
    if (!response.ok) { // Если статус не 2xx (например, 404 Not Found, 500 Server Error)
      // Пытаемся получить текст ошибки из тела ответа
      let errorData = { message: `Request failed with status ${response.status}` }; // Сообщение по умолчанию
      try {
          const errorText = await response.text(); // Читаем тело ответа как текст
          if (errorText) {
              // Пытаемся парсить текст как JSON
              try {
                  errorData = JSON.parse(errorText);
                  // Проверяем, есть ли в объекте ошибки поле message
                  if (typeof errorData !== 'object' || !errorData.message) {
                     // Если нет, используем ограниченный текст ошибки
                     errorData = { message: errorText.substring(0, 200) };
                  }
              } catch (e) {
                  // Если парсинг JSON не удался, используем ограниченный текст ошибки
                   errorData = { message: errorText.substring(0, 200) };
              }
          }
      } catch (e) {
          // Если чтение тела ответа не удалось
          console.warn(`[API] Could not read or parse error response body for ${url}. Status: ${response.status}`);
          // Используем сообщение по умолчанию
      }
      // Логируем ошибку
      console.error(`[API] ${method} request to ${url} failed! Status: ${response.status}`, errorData);
      // Создаем и выбрасываем объект ошибки с сообщением от сервера или статусом
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    }

    // Если статус ответа OK (2xx)
    try {
        // Проверяем заголовок Content-Type ответа
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            // Если ответ содержит JSON, парсим и возвращаем его
            const responseData = await response.json();
            console.log(`[API] ${method} request to ${url} successful. Response:`, responseData);
            return responseData; // Возвращаем распарсенные данные
        } else {
            // Если ответ не JSON (например, 204 No Content или просто текст),
            // возвращаем объект успеха со статусом
            console.log(`[API] ${method} request to ${url} successful with status ${response.status}. No JSON response body.`);
            return { success: true, status: response.status };
        }
    } catch (e) {
        // Если произошла ошибка при парсинге JSON (неожиданно для успешного статуса)
        console.warn(`[API] Error parsing JSON response for ${url} (Status: ${response.status}):`, e);
        // Все равно возвращаем успех, так как статус был OK
        return { success: true, status: response.status, warning: "Could not parse JSON response" };
    }

  } catch (error) {
    // Ловим ошибки сети (например, fetch не удался) или ошибки, выброшенные из блока !response.ok
    console.error(`[API] Network or fetch error during ${method} request to ${url}:`, error);
    // Пробрасываем ошибку дальше, чтобы ее можно было поймать в вызывающем коде (например, в main.js)
    throw error;
  }
}
