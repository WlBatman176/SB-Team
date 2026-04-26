# SB Team — Bot Discord Staff

Bot Discord pour créer automatiquement les catégories et salons Staff / Owner.

## Fonctionnalités

- **Prefix** : `-`
- **Mention** : quand tu ping le bot, il répond **mon prefix est -**
- **`-staff`** : crée les catégories **Staff** et **Owner** avec tous les salons (privés)

### Salons créés

**Catégorie Staff** (privée) :
| Salon | Type |
|---|---|
| 📣・annonces-staff | texte |
| 📗・règlement-staff | texte |
| 📑・hiérachie | texte |
| 🔮・comment-rank-up | texte |
| 📋・missions-staff | texte |
| 🟤・chat-réu | texte |
| 📒・recap-reu | texte |

**Catégorie Owner** (privée) :
| Salon | Type |
|---|---|
| 😈・derank-statut | texte |
| 📣・annonces-owner | texte |
| 💬・only-owner | texte |
| 🔮・charte-owner | texte |
| Owner Metting | vocal |

## Installation

```bash
pip install -r requirements.txt
```

## Lancement

1. Remplace `TON_TOKEN_ICI` par ton token de bot Discord, ou définis la variable d'environnement :
   ```bash
   export DISCORD_TOKEN="ton_token_ici"
   ```
2. Lance le bot :
   ```bash
   python bot.py
   ```

## Permissions requises

Le bot nécessite les permissions suivantes sur ton serveur Discord :
- Gérer les salons (Manage Channels)
- Lire les messages (Read Messages)
- Envoyer des messages (Send Messages)
