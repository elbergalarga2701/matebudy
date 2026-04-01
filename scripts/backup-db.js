#!/usr/bin/env node

/**
 * Script para crear backups de la base de datos
 * Uso: node scripts/backup-db.js
 */

import { createBackup, listBackups } from '../server/utils/backup.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';

  console.log('💾 MateBudy - Backup de Base de Datos\n');

  try {
    if (command === 'create') {
      console.log('Creando backup...');
      const backupPath = await createBackup();
      
      if (backupPath) {
        console.log(`\n✅ Backup creado exitosamente: ${backupPath}`);
      } else {
        console.log('⚠️  No se creó el backup (base de datos no encontrada)');
      }
    } else if (command === 'list') {
      console.log('Listando backups disponibles...\n');
      const backups = await listBackups();
      
      if (backups.length === 0) {
        console.log('No hay backups disponibles.');
      } else {
        console.log(`Backups encontrados: ${backups.length}\n`);
        backups.forEach((backup, index) => {
          console.log(`${index + 1}. ${backup.filename}`);
          console.log(`   Tamaño: ${(backup.size / 1024).toFixed(2)} KB`);
          console.log(`   Creado: ${backup.createdAt}`);
          console.log('');
        });
      }
    } else if (command === 'help') {
      console.log('Uso: node scripts/backup-db.js [comando]');
      console.log('\nComandos disponibles:');
      console.log('  create  - Crear un nuevo backup (por defecto)');
      console.log('  list    - Listar backups disponibles');
      console.log('  help    - Mostrar esta ayuda');
    } else {
      console.error(`Comando desconocido: ${command}`);
      console.log('Usa "node scripts/backup-db.js help" para ver los comandos disponibles.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
