# portfolio

Portfolio de développeur back-end, site statique sans étape de build, publié sur GitHub Pages depuis `main` (https://teddyrhim.github.io/portofolie/). Version 3D (Three.js, descente dans un couloir gothique pilotée par le scroll) et version légère 2D de repli.

## Commandes
- Prévisualiser (les modules ES exigent un serveur) : `python -m http.server 8766 --bind 127.0.0.1`, puis http://127.0.0.1:8766/.
- Pas de tests ni de lint. Vérifier à la main : rendu 3D, version `light.html`, mode `?toon`, bouton son, galerie d'images, version anglaise.
- Vérifier le site en ligne : comparer `git log -1` avec la page publiée, ouvrir l'URL en rechargement forcé, contrôler les `?v=` des imports et des médias.

## Structure
- `index.html` : page 3D (CSS, JSON-LD, textes FR et EN dans l'objet `T`, galerie, bouton son). Importe `scene.js?v=N` et `audio.js?v=N`.
- `scene.js` : scène Three.js (porte, couloir, bannières, tableaux, brasero), textures procédurales, style toon.
- `audio.js` : ambiance Web Audio entièrement synthétisée, sans fichier audio.
- `light.html` : version 2D autonome (son propre CSS, JavaScript et textes).
- `cv/` : sources HTML du CV en français et en anglais, et les PDF correspondants. `media/` : captures des projets et image de partage.
- `robots.txt`, `sitemap.xml`, `.nojekyll`, `README.md`, `LICENSE`.

## Paramètres et comportements
- `?3d` force la 3D malgré « réduire les animations » ou un écran étroit ; `?toon` active le style manga sombre (triple clic sur le logo pour basculer).
- Redirection vers `light.html` si pas de WebGL, `prefers-reduced-motion`, largeur inférieure à 700 px (sauf `?3d`) ou échec de chargement de la scène.
- Le son est coupé par défaut et ne démarre qu'au clic. Les volumes ont été réglés finement sur plusieurs itérations : ne pas les modifier sans demande.
- Anciennes variantes `scene-modern.js` et `scene-toon.js` supprimées : ne pas les recréer.

## Pièges
- Le cache est géré à la main : incrémenter `?v=` sur `scene.js`, `audio.js` et les médias après toute modification.
- URL canoniques, `og:url`, `robots.txt` et `sitemap.xml` sont liés au chemin `/portofolie/` : ne pas les changer sans le chemin.
- Les PDF sont des binaires à régénérer depuis `cv/cv-source*.html` (impression du navigateur) ; aucun script de génération n'est versionné.
- Les captures de `media/` utilisent des données fictives, 1600 x 1000 : les refaire avec les mêmes conditions.
- Dépendances externes : Three.js 0.160.0 via jsDelivr, polices Google Fonts. Rien d'autre.

## Données personnelles
Le site publie volontairement le nom d'affichage, le pseudo GitHub, le profil LinkedIn, l'adresse e-mail professionnelle et le CV (employeurs compris). Rien d'autre ne doit y figurer : ni téléphone, ni adresse, ni date de naissance, ni adresse e-mail privée.
