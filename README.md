# 📚 StudyCourse

App para organizar estudos de concurso: contagem regressiva para a prova, etapas do concurso, matérias e tópicos do edital, e registro de horas de estudo (com cronômetro). Dados salvos no Firebase (Realtime Database) com login Google.

## ⚙️ Configuração do Firebase (só na primeira vez)

O projeto Firebase **studycourse** já existe. Falta registrar o app web e colar a configuração:

1. Abra o [Console do Firebase](https://console.firebase.google.com/) → projeto **studycourse**
2. Clique em **+ Adicionar app** → escolha o ícone **Web `</>`**
3. Dê o apelido `studycourse` e clique em **Registrar app** (não precisa marcar Hosting)
4. Copie o bloco `firebaseConfig` que aparece
5. Abra o arquivo **app.js** e substitua o bloco `FIREBASE_CONFIG` no topo pelos seus valores

### Ativar o login com Google
1. No console: **Criação** (Build) → **Authentication** → **Vamos começar**
2. Aba **Sign-in method** → **Google** → **Ativar** → Salvar

### Configurar o banco de dados (Realtime Database)
1. No console: **Criação** (Build) → **Realtime Database** (já criado ✅)
2. Na aba **Regras**, cole e publique:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

> ⚠️ Importante: a configuração no `app.js` precisa ter a linha `databaseURL` (aparece na aba **Dados** do Realtime Database, algo como `https://studycourse-xxxx-default-rtdb.firebaseio.com`).

## ▶️ Como usar

Abra o `index.html` no navegador (ou publique no GitHub Pages) e entre com sua conta Google.

- **Meus concursos**: cadastre o concurso com data da prova e link do edital
- **Etapas**: acompanhe em qual fase o concurso está (inscrições, prova, resultado...)
- **Matérias**: cole os tópicos do edital, um por linha; clique no tópico para marcar ⬜ → ✅ estudado → 🔁 revisado
- **Estudos**: use o cronômetro ou registre manualmente o tempo estudado por matéria
- **Resumo**: veja quantos dias faltam para a prova, a etapa atual e seu progresso no edital
