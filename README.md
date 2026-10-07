# Portfolio de Teddy Rhim

Portfolio de développeur full-stack : une descente en 3D dans un couloir gothique à la lueur des bougies, avec trois projets accrochés comme des tableaux et un brasero à la fin.

- **`index.html`** : version 3D (Three.js, WebGL), pilotée par le défilement.
- **`light.html`** : version légère en 2D, utilisée automatiquement sur petit écran, sans WebGL ou avec « réduire les animations ». Accessible aussi via le lien « Version légère ».
- **`scene.js`** : la scène 3D (couloir, tableaux, brasero, chauves-souris).
- **`media/`** : captures des projets, réalisées avec des **données fictives**.

Site statique, sans étape de compilation. Three.js est chargé depuis un CDN.

## Lancer en local

Les modules JavaScript ne s'exécutent pas depuis un fichier ouvert directement : il faut un petit serveur.

```bash
python -m http.server 8766 --bind 127.0.0.1
```

Puis ouvrir <http://127.0.0.1:8766/>.

## Projets présentés

- [cta-campaign-manager](https://github.com/TeddyRhim/cta-campaign-manager) : FastAPI, PostgreSQL, Next.js, TypeScript.
- [assistant-candidature](https://github.com/TeddyRhim/assistant-candidature) : Python, Streamlit, SQLite.
- [ChatbotIA](https://github.com/TeddyRhim/ChatbotIA) : RAG local avec Ollama et ChromaDB.
