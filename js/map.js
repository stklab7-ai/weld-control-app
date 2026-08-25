/**
 * map.js — всё, что связано с картой Leaflet
 *
 * Отвечает за:
 *  - инициализацию карты
 *  - отображение маркеров заявок (создание/обновление/удаление)
 *  - drag-and-drop маркеров
 *  - клик по карте (пустое место)
 *  - геолокацию пользователя
 *  - двойной клик по маркеру (редактирование)
 */

const MapModule = (() => {
  // Иконки Font Awesome по типу контроля
  const TYPE_ICON = {
    Вик: 'fa-eye',
    Узк: 'fa-wave-square',
    Рк: 'fa-radiation',
    Цд: 'fa-magnifying-glass',
  };

  let map = null;
  let markers = new Map(); // id заявки -> Leaflet marker

  // Внешние обработчики событий (задаются через on...)
  let handlers = {
    onMapClick: null, // (lat, lng) => void
    onMarkerDragEnd: null, // (id, lat, lng) => void
    onMarkerDoubleClick: null, // (id) => void
    onEditFromPopup: null, // (id) => void
  };

  /** Создаёт кастомную DivIcon для маркера заданного типа контроля */
  function buildIcon(controlType) {
    const iconClass = TYPE_ICON[controlType] || 'fa-location-dot';
    return L.divIcon({
      className: '', // сбрасываем стандартный класс leaflet
      html: `<div class="weld-marker m-${controlType}"><i class="fa-solid ${iconClass}"></i></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -26],
    });
  }

  /** Инициализирует карту в контейнере #map */
  function init(containerId, options = {}) {
    try {
      const defaultCenter = options.center || [55.751244, 37.618423]; // Москва по умолчанию
      const defaultZoom = options.zoom || 11;

      map = L.map(containerId, {
        zoomControl: true,
      }).setView(defaultCenter, defaultZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Клик по карте (пустое место)
      map.on('click', (e) => {
        if (typeof handlers.onMapClick === 'function') {
          handlers.onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });

      return map;
    } catch (err) {
      console.error('[MapModule] Ошибка инициализации карты:', err);
      throw err;
    }
  }

  /** Регистрирует внешние обработчики событий карты */
  function setHandlers(newHandlers) {
    handlers = { ...handlers, ...newHandlers };
  }

  /** Формирует HTML содержимого попапа для заявки */
  function buildPopupHtml(request) {
    const statusClass = 'st-' + request.status.toLowerCase().replace(/\s+/g, '-');
    return `
      <div class="popup-content">
        <p class="popup-title">${escapeHtml(request.objectName)}</p>
        <div class="popup-row"><i class="fa-solid fa-tag"></i> ${escapeHtml(request.controlType)}</div>
        <div class="popup-row"><i class="fa-solid fa-circle-dot"></i> ${escapeHtml(request.status)}</div>
        <div class="popup-row"><i class="fa-solid fa-user"></i> ${escapeHtml(request.author)}</div>
        <div class="popup-row"><i class="fa-solid fa-location-dot"></i> ${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}</div>
        <button class="popup-edit-btn" data-id="${request.id}">
          <i class="fa-solid fa-pen"></i> Редактировать
        </button>
      </div>
    `;
  }

  /** Простое экранирование HTML для защиты от инъекций через пользовательский текст */
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Добавляет маркер заявки на карту */
  function addMarker(request) {
    if (!map) return null;
    try {
      const marker = L.marker([request.latitude, request.longitude], {
        icon: buildIcon(request.controlType),
        draggable: true,
        riseOnHover: true,
      }).addTo(map);

      marker.bindPopup(buildPopupHtml(request), { closeButton: true });

      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        if (typeof handlers.onMarkerDragEnd === 'function') {
          handlers.onMarkerDragEnd(request.id, pos.lat, pos.lng);
        }
      });

      marker.on('dblclick', () => {
        if (typeof handlers.onMarkerDoubleClick === 'function') {
          handlers.onMarkerDoubleClick(request.id);
        }
      });

      marker.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        const btn = el.querySelector('.popup-edit-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            if (typeof handlers.onEditFromPopup === 'function') {
              handlers.onEditFromPopup(request.id);
            }
          });
        }
      });

      markers.set(request.id, marker);
      return marker;
    } catch (err) {
      console.error('[MapModule] Ошибка добавления маркера:', err);
      return null;
    }
  }

  /** Обновляет существующий маркер (позицию, иконку, попап) */
  function updateMarker(request) {
    const marker = markers.get(request.id);
    if (!marker) {
      // Если маркера нет — создаём новый
      return addMarker(request);
    }
    try {
      marker.setLatLng([request.latitude, request.longitude]);
      marker.setIcon(buildIcon(request.controlType));
      marker.setPopupContent(buildPopupHtml(request));
      return marker;
    } catch (err) {
      console.error('[MapModule] Ошибка обновления маркера:', err);
      return null;
    }
  }

  /** Удаляет маркер по id заявки */
  function removeMarker(id) {
    const marker = markers.get(id);
    if (marker && map) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  }

  /** Полностью перерисовывает все маркеры из списка заявок */
  function renderAll(requests) {
    if (!map) return;
    // Удаляем маркеры, которых больше нет в списке
    const currentIds = new Set(requests.map((r) => r.id));
    for (const id of Array.from(markers.keys())) {
      if (!currentIds.has(id)) removeMarker(id);
    }
    // Добавляем/обновляем маркеры
    requests.forEach((request) => {
      if (markers.has(request.id)) {
        updateMarker(request);
      } else {
        addMarker(request);
      }
    });
  }

  /** Показывает/скрывает маркеры согласно фильтру (видимость без удаления данных) */
  function setMarkerVisibility(requests, visibleIds) {
    requests.forEach((r) => {
      const marker = markers.get(r.id);
      if (!marker || !map) return;
      const shouldShow = visibleIds.has(r.id);
      const hasLayer = map.hasLayer(marker);
      if (shouldShow && !hasLayer) marker.addTo(map);
      if (!shouldShow && hasLayer) map.removeLayer(marker);
    });
  }

  /** Центрирует карту на заданной точке и открывает попап маркера */
  function focusOn(id) {
    const marker = markers.get(id);
    if (marker && map) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
      marker.openPopup();
    }
  }

  /** Центрирует карту на координатах без открытия попапа */
  function centerOn(lat, lng, zoom) {
    if (map) {
      map.setView([lat, lng], zoom || map.getZoom(), { animate: true });
    }
  }

  /** Запрашивает геолокацию пользователя и центрирует карту */
  function locateUser(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError(new Error('Геолокация не поддерживается вашим браузером'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        centerOn(latitude, longitude, 15);
        if (onSuccess) onSuccess(latitude, longitude);
      },
      (err) => {
        console.error('[MapModule] Ошибка геолокации:', err);
        if (onError) onError(err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** Программно ставит/двигает временный маркер выбора точки (для новой заявки) */
  function setTempMarker(lat, lng, controlType) {
    removeTempMarker();
    if (!map) return;
    tempMarker = L.marker([lat, lng], {
      icon: buildIcon(controlType || 'Вик'),
      draggable: false,
      opacity: 0.85,
    }).addTo(map);
  }

  let tempMarker = null;

  function removeTempMarker() {
    if (tempMarker && map) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
  }

  function getMap() {
    return map;
  }

  return {
    init,
    setHandlers,
    addMarker,
    updateMarker,
    removeMarker,
    renderAll,
    setMarkerVisibility,
    focusOn,
    centerOn,
    locateUser,
    setTempMarker,
    removeTempMarker,
    getMap,
  };
})();
