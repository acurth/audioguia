# Deploy a producción con GitHub Actions

Esta guía explica cómo configurar una sola vez el deploy de audioguia.io, y cómo se usa después.

El workflow `.github/workflows/deploy-production.yml` compila el sitio (`npm run build`) y copia la carpeta `build/` al servidor con `rsync` por SSH. Todo queda en la cuenta personal de GitHub `acurth`, repositorio `acurth/audioguia`.

- **Lo que dispara un deploy real:** subir un tag `deploy-prod-*`, o una ejecución manual con `dry_run` apagado.
- **Lo que no dispara un deploy:** un push a `main`.
- **Borrar archivos del servidor:** sólo en una ejecución manual con `delete_remote` encendido. Un tag nunca borra nada.

## 1. Crear el environment `production`

1. En GitHub: `acurth/audioguia` → Settings → Environments → New environment → nombre `production`.
2. Recomendado: en "Deployment protection rules" marcá "Required reviewers" y agregate a vos. Así cada deploy espera tu aprobación. En un repositorio público esto está disponible en el plan gratuito.
3. En "Deployment branches and tags" elegí "Selected branches and tags" y agregá la regla de tag `deploy-prod-*` y la rama `main`.

## 2. Crear una clave SSH sólo para el deploy

En tu Mac:

```bash
ssh-keygen -t ed25519 -C "github-deploy audioguia.io" -f ~/.ssh/audioguia_deploy -N ""
```

- `~/.ssh/audioguia_deploy` es la clave privada. Va sólo al secret `SSH_PRIVATE_KEY`. No la copies a ningún otro lado.
- `~/.ssh/audioguia_deploy.pub` es la clave pública. Va al servidor.

Autorizá la clave pública en el servidor, con el usuario SSH dueño del sitio:

```bash
ssh-copy-id -i ~/.ssh/audioguia_deploy.pub USUARIO@HOST
```

Para limitar lo que puede hacer esa clave, en `~/.ssh/authorized_keys` del servidor podés anteponer a esa línea `no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty`.

## 3. Cargar los secrets del environment

En Settings → Environments → `production` → Environment secrets:

| Secret | Qué va | Ejemplo de forma |
| --- | --- | --- |
| `SSH_PRIVATE_KEY` | contenido completo de `~/.ssh/audioguia_deploy` | `-----BEGIN OPENSSH PRIVATE KEY-----…` |
| `SSH_HOST` | host SSH del hosting | `REEMPLAZAR.dreamhost.com` |
| `SSH_PORT` | puerto SSH | `22` |
| `SSH_USER` | usuario SSH dueño del sitio | `REEMPLAZAR` |
| `REMOTE_PATH` | document root de audioguia.io, sin barra final | `/home/REEMPLAZAR/audioguia.io` |
| `SSH_KNOWN_HOSTS` | la línea verificada del paso 4 | `host ssh-ed25519 AAAA…` |

En Environment variables (no secrets), opcional:

| Variable | Qué va |
| --- | --- |
| `VITE_MAPBOX_TOKEN` | el token público `pk.` de Mapbox, el mismo de tu `.env` local. Sin él, el mapa usa el dibujo sobre fondo verde. |

## 4. Obtener y verificar la huella del servidor

El workflow sólo se conecta a un servidor cuya clave ya conoce. Nunca desactiva la verificación.

1. Obtené la línea:

   ```bash
   ssh-keyscan -t ed25519 -p 22 HOST
   ```

2. Mirá la huella de esa línea:

   ```bash
   ssh-keyscan -t ed25519 -p 22 HOST | ssh-keygen -lf -
   ```

3. Comparala con la huella por un canal confiable: el panel del hosting, soporte del hosting, o tu propio `~/.ssh/known_hosts` si ya te conectaste antes a ese servidor (`ssh-keygen -F HOST -l`). Si no coinciden, no sigas.
4. Pegá la línea del paso 1 en el secret `SSH_KNOWN_HOSTS`.

## 5. Primera ejecución

1. Actions → Deploy Production → Run workflow, sobre `main`, con `dry_run` encendido, `delete_remote` apagado y `run_lint` encendido.
2. Leé el log del paso "Deploy with rsync". Cada línea que empieza con `<f` es un archivo que se enviaría. Revisá que la lista tenga sentido y que no aparezca nada de fuera de `build/`.
3. Repetí con `dry_run` apagado. Ese es el primer deploy real.
4. Abrí https://audioguia.io y https://audioguia.io/contacto para confirmar.

## 6. Ship normal

```bash
git tag deploy-prod-YYYYMMDD-HHMM
git push origin deploy-prod-YYYYMMDD-HHMM
```

El tag hace un deploy real, sin borrar archivos del servidor.

## 7. Rollback

Creá un tag nuevo sobre un commit que sabés que andaba bien:

```bash
git tag deploy-prod-rollback-YYYYMMDD-HHMM <sha_del_commit_bueno>
git push origin deploy-prod-rollback-YYYYMMDD-HHMM
```

## 8. Lo que el deploy nunca toca

- `audioguia-mail.php`, con la contraseña SMTP. Vive un nivel arriba del document root, fuera de lo que `rsync` escribe.
- Las rutas de `.deployignore`, incluso con `delete_remote`: `.well-known/`, `.dh-diag`, `stats/`, `favicon.ico`, `.env*` y los propios archivos de correo.

Antes de la primera ejecución con `delete_remote` encendido, hacela primero con `dry_run` encendido y leé cada línea `*deleting`.

## Configuración del formulario de contacto

El formulario envía por SMTP con la cuenta que definas en `audioguia-mail.php`. Ese archivo no está en el repositorio.

1. Copiá `audioguia-mail.example.php` al servidor, un nivel arriba del document root, con el nombre `audioguia-mail.php`. Si el document root es `/home/USUARIO/audioguia.io`, el archivo va en `/home/USUARIO/audioguia-mail.php`.
2. Completá los valores reales en el servidor, no en tu copia del repo.
3. Dejalo legible sólo por tu usuario: `chmod 600 /home/USUARIO/audioguia-mail.php`.

Como alternativa, la variable de entorno `AUDIOGUIA_MAIL_CONFIG` puede apuntar a otra ruta.

Si algo falla, el visitante ve un mensaje genérico y el motivo técnico queda en el log de errores de PHP del hosting, con el prefijo `[audioguia contacto]`.
