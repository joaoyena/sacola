# Teggram-X Admin

Painel administrativo com frontend React/Vite, API Express e persistência em Cloud Firestore. O servidor valida os Firebase ID tokens e só permite operações a contas com custom claim `admin: true` ou `role: "admin" | "superadmin"`.

## Configurar o Firebase

1. Copie `.env.example` para `.env` e preencha as variáveis `VITE_FIREBASE_*` com as configurações do projeto Firebase. Essas variáveis são públicas e usadas pelo navegador.
2. Preencha `FIREBASE_PROJECT_ID` (ou mantenha `VITE_FIREBASE_PROJECT_ID` preenchido).
3. Defina `VITE_FIREBASE_ADMIN_EMAIL` e `FIREBASE_ADMIN_EMAIL` com o mesmo endereço autorizado para o primeiro cadastro administrativo.
4. Para o backend, configure credenciais de Firebase Admin. Use uma destas opções:
   - `GOOGLE_APPLICATION_CREDENTIALS` apontando para o ficheiro JSON da conta de serviço; ou
   - `FIREBASE_SERVICE_ACCOUNT_JSON` contendo o JSON da conta de serviço.

O ficheiro de credenciais é privado, não deve ser enviado ao Git nem colocado em qualquer variável `VITE_*`. Em produção, prefira a identidade de serviço/credenciais ADC do ambiente de execução em vez de guardar uma chave privada.

Ative o método **Email/Password** em Firebase Authentication. Na página de acesso, use **Primeiro acesso? Cadastrar administrador** para criar a conta do email autorizado. A conta recebe o acesso administrativo apenas depois de confirmar o email; os custom claims são atribuídos pelo servidor. Outros endereços não podem usar o cadastro para obter privilégios administrativos.

## Executar localmente

```bash
bun install
bun run dev
```

Abra `http://localhost:3000`. A API lê e grava as coleções `users`, `paymentbot`, `retiradas`, `produtos`, `cupons`, `pasta`, `extrato_mcpn` e `admin_audit_logs` no Firestore configurado. No painel, a secção **Cupons** permite gerar códigos, definir o valor, ativar/desativar, editar e excluir cupons; a criação prepara os campos de resgate usados pela aplicação e as alterações administrativas são auditadas. Aprovações financeiras e respetiva auditoria são gravadas numa transação Firestore.

## Instalar como aplicação (PWA)

O painel inclui manifesto, ícones e service worker. Em produção, publique-o num domínio HTTPS (ou teste em `localhost`); navegadores compatíveis apresentam **Instalar aplicação** no menu do painel ou a opção de instalação do próprio navegador. No iPhone/iPad, abra o painel no Safari, toque em **Partilhar** e escolha **Adicionar ao ecrã principal**.

O service worker mantém em cache apenas o shell e recursos estáticos da aplicação para permitir abrir a interface sem ligação. Pedidos à API (`/api/`) nunca são guardados em cache; autenticação, dados e ações administrativas continuam a exigir ligação à internet.

Para validar a compilação frontend:

```bash
bun run build
```

## Publicar na Render

O ficheiro `render.yaml` configura um serviço Web Node.js que compila o frontend e inicia a API Express. Na Render, crie um Blueprint a partir do repositório e preencha as variáveis de ambiente solicitadas:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`: configuração do Firebase usada pelo navegador. A Render precisa destas variáveis durante o build.
- `VITE_FIREBASE_ADMIN_EMAIL` e `FIREBASE_ADMIN_EMAIL`: use o mesmo email autorizado para o primeiro administrador.
- `FIREBASE_PROJECT_ID`: ID do projeto Firebase usado pelo servidor.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de serviço do Firebase Admin. Guarde-o como variável secreta na Render; não o adicione ao Git nem use um prefixo `VITE_`.

Ative **Email/Password** no Firebase Authentication e adicione o domínio exato gerado pela Render (por exemplo, `teggram-x-admin.onrender.com`) ou o domínio personalizado à lista de domínios autorizados. O serviço usa a porta fornecida pela Render e serve o frontend e a API no mesmo domínio.
