# Push y ship

Estas son las palabras que usa Axel para publicar audioguia.io, y lo que significa cada una. Sirve para colaboradores y para agentes. La configuración del deploy está en `GITHUB_DEPLOY.md`.

- **push:** revisar los cambios, commitear sólo los que son intencionales, y subir `main`.
- **ship:** crear y subir un tag `deploy-prod-YYYYMMDD-HHMM` con la hora local. Esto publica en producción.
- **push and ship:** las dos cosas, en ese orden.

Nada de esto se hace si Axel no lo pide con esas palabras.

## Cuenta

El proyecto es personal: cuenta de GitHub `acurth`, repositorio `acurth/audioguia`, commits con `acurth@gmail.com`. No uses ninguna cuenta ni email de IHRDC.

## Antes de commitear

```bash
git status --short
git diff --check
git diff
```

- Commiteá sólo lo que corresponde al pedido. Si hay cambios ajenos, dejalos como están y avisá.
- Nunca commitees `audioguia-mail.php`, `.env`, `certs/` ni ninguna clave.
- No uses comandos destructivos (`reset --hard`, `push --force`, borrar tags remotos) sin pedido explícito.

## Push

```bash
git push origin main
```

## Ship

```bash
TAG="deploy-prod-$(date +%Y%m%d-%H%M)"
git tag "$TAG"
git push origin "$TAG"
```

## Después del ship

```bash
gh run list --workflow "Deploy Production" --limit 3
gh run watch
```

Cuando el run termine en verde, abrí la URL pública que cambió (por ejemplo https://audioguia.io o https://audioguia.io/contacto) y confirmá que se ve el cambio. Si el environment tiene revisores, el run espera la aprobación de Axel en GitHub antes de publicar.

Si algo salió mal, el rollback está en `GITHUB_DEPLOY.md`, paso 7.
