#!/usr/bin/env node

/**
 * Script para hacer deploy automático a Render
 * Uso: node scripts/deploy-render.js [backend|frontend|all]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Deploy hooks de Render
const DEPLOY_HOOKS = {
  // Backend (Node.js)
  backend: 'https://api.render.com/deploy/srv-d765v68gjchc73839cp0?key=qyzVDHhFpW8',
  
  // Frontend (Static)
  frontend: 'https://api.render.com/deploy/srv-d764a8nfte5s73cgqbt0?key=3lm4ZMtA7Lc',
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  
  const icon = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };
  
  console.log(`${colors[type]}${icon[type]} ${message}${colors.reset}`);
}

function exec(command) {
  try {
    return execSync(command, { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    log(`Error ejecutando: ${command}`, 'error');
    throw error;
  }
}

function buildFrontend() {
  log('Construyendo frontend...', 'info');
  exec('npm run build');
  log('Frontend construido exitosamente', 'success');
}

function triggerDeploy(service) {
  const hook = DEPLOY_HOOKS[service];
  
  if (!hook) {
    log(`Deploy hook no encontrado para: ${service}`, 'error');
    return false;
  }
  
  log(`Iniciando deploy de ${service} en Render...`, 'info');
  
  try {
    const curl = process.platform === 'win32' 
      ? 'curl' 
      : 'curl -s -o /dev/null';
    
    execSync(`${curl} -X POST "${hook}"`, { 
      stdio: process.platform === 'win32' ? 'inherit' : 'pipe',
      cwd: projectRoot 
    });
    
    log(`Deploy de ${service} iniciado correctamente`, 'success');
    log(`Render está desplegando... esto toma 2-5 minutos`, 'info');
    log(`Puedes ver el progreso en: https://dashboard.render.com`, 'info');
    
    return true;
  } catch (error) {
    log(`Error al iniciar deploy: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'all';
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 MATEBUDY - DEPLOY AUTOMÁTICO A RENDER');
  console.log('='.repeat(60) + '\n');
  
  try {
    if (target === 'backend' || target === 'all') {
      log('Deploy de BACKEND...', 'info');
      const success = triggerDeploy('backend');
      if (!success) process.exit(1);
    }
    
    if (target === 'frontend' || target === 'all') {
      log('Deploy de FRONTEND...', 'info');
      
      // Build del frontend
      buildFrontend();
      
      // Trigger deploy
      const success = triggerDeploy('frontend');
      if (!success) process.exit(1);
    }
    
    console.log('\n' + '='.repeat(60));
    log('¡DEPLOY INICIADO!', 'success');
    console.log('='.repeat(60) + '\n');
    
    log('Próximos pasos:', 'info');
    console.log('  1. Espera 2-5 minutos a que Render termine el deploy');
    console.log('  2. Verifica en: https://dashboard.render.com');
    console.log('  3. La APK detectará el cambio en ~60 segundos\n');
    
    log('URLs de tus servicios:', 'info');
    console.log('  Backend:  https://matebudy.onrender.com');
    console.log('  Frontend: https://matebudy-1.onrender.com\n');
    
  } catch (error) {
    log(`Error durante el deploy: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
