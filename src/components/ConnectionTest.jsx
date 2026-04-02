import React, { useEffect, useState } from 'react';
import { apiUrl } from '../api';

export default function ConnectionTest() {
  const [result, setResult] = useState({
    status: 'checking',
    message: 'Verificando conexion...',
    details: null,
  });

  useEffect(() => {
    void checkConnection();
  }, []);

  const checkConnection = async () => {
    const backendUrl = apiUrl('/api/health');
    
    setResult({
      status: 'checking',
      message: 'Verificando...',
      details: { backendUrl },
    });

    try {
      console.log('[ConnectionTest] Fetching:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('[ConnectionTest] Response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      const data = await response.json();
      
      setResult({
        status: 'success',
        message: 'Conexion exitosa!',
        details: {
          backendUrl,
          responseStatus: response.status,
          data,
        },
      });
    } catch (error) {
      console.error('[ConnectionTest] Error:', error);
      setResult({
        status: 'error',
        message: 'Error de conexion',
        details: {
          backendUrl,
          error: error.message,
          errorType: error.constructor.name,
        },
      });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      left: 10,
      right: 10,
      background: result.status === 'success' ? '#10b981' : result.status === 'error' ? '#ef4444' : '#f59e0b',
      color: 'white',
      padding: 12,
      borderRadius: 8,
      fontSize: 12,
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {result.status === 'success' ? '✅ Backend Conectado' : result.status === 'error' ? '❌ Error de Conexion' : '⏳ Verificando...'}
      </div>
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        {result.message}
      </div>
      {result.details && (
        <details style={{ marginTop: 8, fontSize: 10 }}>
          <summary style={{ cursor: 'pointer', opacity: 0.8 }}>Ver detalles</summary>
          <pre style={{ 
            marginTop: 4, 
            background: 'rgba(0,0,0,0.3)', 
            padding: 8, 
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {JSON.stringify(result.details, null, 2)}
          </pre>
        </details>
      )}
      <button
        onClick={checkConnection}
        style={{
          marginTop: 8,
          padding: '6px 12px',
          background: 'white',
          color: result.status === 'success' ? '#10b981' : result.status === 'error' ? '#ef4444' : '#f59e0b',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
