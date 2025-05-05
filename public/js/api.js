// public/js/api.js

/**
 * Отправляет данные на сервер указанным методом.
 * @param {string} url - URL эндпоинта API.
 * @param {object} data - Данные для отправки.
 * @param {string} [method='POST'] - HTTP метод (POST, PUT, etc.).
 * @returns {Promise<object>} - Promise с ответом сервера в формате JSON.
 */
export async function saveData(url, data, method = 'POST') {
  console.log(`[API] Sending ${method} request to ${url} with data:`, data);
  try {
    const response = await fetch(url, {
      method: method, // Используем переданный метод
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    // Проверяем статус ответа
    if (!response.ok) {
      // Пытаемся прочитать тело ошибки, если оно есть
      let errorData = { message: `Request failed with status ${response.status}` }; // Сообщение по умолчанию
      try {
          const errorText = await response.text(); // Читаем как текст на случай не-JSON ответа
          if (errorText) {
              errorData = JSON.parse(errorText); // Пытаемся парсить JSON
          }
      } catch (e) {
          console.warn(`[API] Could not parse error response body for ${url}. Status: ${response.status}`);
          // Используем сообщение по умолчанию
      }
      console.error(`[API] ${method} request to ${url} failed! Status: ${response.status}`, errorData);
      // Пробрасываем ошибку дальше с сообщением от сервера или статусом
      throw new Error(errorData.message || `HTTP error ${response.status}`);
    }

    // Если все ок, парсим JSON ответ (даже для PUT/POST)
    // Некоторые API могут возвращать обновленные данные или статус успеха
    try {
        const responseData = await response.json();
        console.log(`[API] ${method} request to ${url} successful. Response:`, responseData);
        return responseData;
    } catch (e) {
        // Если ответ пустой или не JSON (например, статус 204 No Content)
        console.log(`[API] ${method} request to ${url} successful with status ${response.status}. No JSON response body.`);
        return { success: true, status: response.status }; // Возвращаем объект успеха
    }

  } catch (error) {
    console.error(`[API] Network or fetch error during ${method} request to ${url}:`, error);
    // Пробрасываем ошибку дальше, чтобы ее можно было поймать в вызывающем коде
    throw error; // Пробрасываем исходную ошибку (может быть TypeError или Error из блока !response.ok)
  }
}
