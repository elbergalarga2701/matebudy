import React from 'react';

export default function MapView({ user }) {
  return (
    <div className="flex-1 flex flex-col pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-secondary">Mapa</h1>
        <p className="text-gray-500 text-sm mt-1">Proveedores cerca de ti</p>
      </div>

      <div className="flex-1 mx-4 mb-4 bg-white rounded-2xl shadow overflow-hidden relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-center p-6">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold text-secondary mb-2">Mapa de proveedores</h3>
          <p className="text-gray-500 text-sm mb-4">
            Aquí se mostrarán los tutores y profesores disponibles cerca de tu ubicación.
          </p>
          <div className="space-y-2 w-full max-w-xs">
            {[
              { name: 'Carlos R.', distance: '0.5 km', icon: '📍' },
              { name: 'María L.', distance: '1.2 km', icon: '📍' },
              { name: 'Juan P.', distance: '2.0 km', icon: '📍' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                <span className="text-lg">{p.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-secondary">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.distance}</p>
                </div>
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
