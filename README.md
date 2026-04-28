# SB-Team - Bot Discord Backup

Bot Discord qui permet de sauvegarder la structure d'un serveur (salons, catégories, rôles) et de la restaurer sur un autre serveur.

## Fonctionnalités

| Commande | Description |
|----------|-------------|
| `<backup` | Sauvegarde la structure du serveur actuel (salons, catégories, rôles) |
| `<backup salon` | Restaure les salons et catégories depuis la backup |
| `<backup role` | Restaure les rôles depuis la backup |
| `<backup all` | Restaure tout (rôles + salons) |
| `<backup info` | Affiche les informations de la backup sauvegardée |

## Installation

### 1. Prérequis
- Python 3.10 ou plus récent
- Un token de bot Discord

### 2. Installer les dépendances
```bash
pip install -r requirements.txt
```

### 3. Configurer le token
```bash
export DISCORD_BOT_TOKEN='votre_token_ici'
```

Ou créer un fichier `.env` à la racine :
```
DISCORD_BOT_TOKEN=votre_token_ici
```

### 4. Lancer le bot
```bash
python bot.py
```

## Utilisation

1. **Sauvegarder** : Allez sur le serveur à copier et tapez `<backup`
2. **Restaurer** : Allez sur un autre serveur et tapez :
   - `<backup salon` pour recréer les salons
   - `<backup role` pour recréer les rôles
   - `<backup all` pour tout restaurer

## Permissions requises

- Le bot nécessite la permission **Administrateur** sur les serveurs
- L'utilisateur doit être **administrateur** du serveur pour utiliser les commandes

## Notes

- Chaque utilisateur a sa propre backup (une seule à la fois)
- Les salons/rôles existants avec le même nom ne sont pas dupliqués
- Les permissions des salons sont aussi sauvegardées et restaurées
