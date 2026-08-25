/**
 * map.js — всё, что связано с картой Leaflet
 */

let map = null;
let markers = {};
let handlers = {};
let currentLayer = null;

/** Инициализация карты */
function init(containerId, options) {
  map = L.map(containerId, {
    center: options.center || [55.751244, 37.618423],
    zoom: options.zoom || 11,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Обработчик клика по карте
  map.on('click', (e) => {
    if (handlers.onMapClick) {
      handlers.onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });

  return map;
}

/** Устанавливает обработчики событий */
function setHandlers(h) {
  handlers = h || {};
}

/** Создаёт HTML-иконку для маркера */
function buildIcon(type, isActive = false) {
  const colors = {
    Вик: '#00ff88',
    Узк: '#ff6b6b',
    Рк: '#ffd93d',
    Цд: '#6c5ce7',
  };
  const icons = {
    Вик: 'fa-eye',
    Узк: 'fa-wave-square',
    Рк: 'fa-radiation',
    Цд: 'fa-magnifying-glass',
  };
  
  const color = colors[type] || '#00d4ff';
  const icon = icons[type] || 'fa-tag';
  const size = isActive ? 32 : 26;

  return L.divIcon({
    html: `<div class="weld-marker m-${type}" style="width:${size}px;height:${size}px;color:${color};">
            <i class="fa-solid ${icon}"></i>
           </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size/2, size],
  });
}

/** Отображает все заявки на карте */
function renderAll(requests) {
  clearMarkers();
  requests.forEach((r) => {
    addMarker(r);
  });
}

/** Добавляет маркер на карту */
function addMarker(request) {
  if (!map) return;
  if (markers[request.id]) {
    updateMarker(request);
    return;
  }

  const icon = buildIcon(request.controlType);
  const marker = L.marker([request.latitude, request.longitude], {
    icon: icon,
    draggable: true,
  }).addTo(map);

  // Всплывающее окно
  const popupContent = `
    <div class="popup-content">
      <div class="popup-title">${escapeHtml(request.objectName)}</div>
      <div class="popup-row"><i class="fa-solid fa-tag"></i>${escapeHtml(request.controlType)}</div>
      <div class="popup-row"><i class="fa-solid fa-user"></i>${escapeHtml(request.author)}</div>
      <div class="popup-row"><i class="fa-solid fa-location-dot"></i>${Number(request.latitude).toFixed(5)}, ${Number(request.longitude).toFixed(5)}</div>
      <button class="popup-edit-btn" data-id="${request.id}"><i class="fa-solid fa-pen"></i> Редактировать</button>
    </div>
  `;
  marker.bindPopup(popupContent);

  // Обработчик редактирования из попапа
  marker.on('popupopen', () => {
    const btn = document.querySelector('.popup-edit-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id || e.target.closest('.popup-edit-btn').dataset.id;
        if (handlers.onEditFromPopup) {
          handlers.onEditFromPopup(id);
        }
        marker.closePopup();
      });
    }
  });

  // Обработчик перетаскивания
  marker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    if (handlers.onMarkerDragEnd) {
      handlers.onMarkerDragEnd(request.id, pos.lat, pos.lng);
    }
  });

  // Обработчик двойного клика
  marker.on('dblclick', () => {
    if (handlers.onMarkerDoubleClick) {
      handlers.onMarkerDoubleClick(request.id);
    }
  });

  markers[request.id] = marker;
}

/** Обновляет маркер */
function updateMarker(request) {
  if (!markers[request.id]) {
    addMarker(request);
    return;
  }
  const marker = markers[request.id];
  marker.setLatLng([request.latitude, request.longitude]);
  marker.setIcon(buildIcon(request.controlType));
}

/** Удаляет маркер */
function removeMarker(id) {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
}

/** Очищает все маркеры */
function clearMarkers() {
  Object.keys(markers).forEach((id) => {
    map.removeLayer(markers[id]);
    delete markers[id];
  });
}

/** Управляет видимостью маркеров (по фильтрам) */
function setMarkerVisibility(requests, visibleIds) {
  requests.forEach((r) => {
    if (markers[r.id]) {
      if (visibleIds.has(r.id)) {
        map.addLayer(markers[r.id]);
      } else {
        map.removeLayer(markers[r.id]);
      }
    }
  });
}

/** Фокусирует карту на маркере */
function focusOn(id) {
  if (markers[id]) {
    const latlng = markers[id].getLatLng();
    map.setView(latlng, 14);
    markers[id].openPopup();
  }
}

/** Геолокация пользователя */
function locateUser(onSuccess, onError) {
  if (!map) return;
  map.locate({ setView: true, maxZoom: 15, watch: false })
    .on('locationfound', (e) => {
      if (onSuccess) onSuccess(e);
    })
    .on('locationerror', (e) => {
      if (onError) onError(e);
    });
}

/** Экранирование HTML */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== ЭКСПОРТ =====
export const MapModule = {
  init,
  setHandlers,
  renderAll,
  addMarker,
  updateMarker,
  removeMarker,
  clearMarkers,
  setMarkerVisibility,
  focusOn,
  locateUser,
};