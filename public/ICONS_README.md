# PWA Icons Setup

Para personalizar os ícones da app, substitui os seguintes ficheiros nesta pasta:

## Ficheiros Necessários

1. **pwa-192x192.png** - Ícone pequeno (192x192px)
2. **pwa-512x512.png** - Ícone grande (512x512px)
3. **apple-touch-icon.png** - Ícone para iOS (180x180px)
4. **favicon.ico** - Favicon do site (32x32px)

## Como Criar os Ícones

### Opção 1: Ferramenta Online (Recomendado)

1. Vai a [https://realfavicongenerator.net/](https://realfavicongenerator.net/)
2. Faz upload do logo do grupo (imagem quadrada, mínimo 512x512px)
3. Ajusta as configurações:
   - iOS: Fundo branco ou cor do grupo
   - Android: Fundo branco ou transparente
4. Descarrega o pacote e substitui os ficheiros

### Opção 2: Criar Manualmente

Usa qualquer editor de imagens (Photoshop, Figma, Canva, etc.):

1. Cria uma imagem quadrada com o logo centrado
2. Exporta nas dimensões:
   - 192x192px → `pwa-192x192.png`
   - 512x512px → `pwa-512x512.png`
   - 180x180px → `apple-touch-icon.png`
3. Converte uma cópia para favicon.ico (32x32px)

### Opção 3: Usando a CLI

Se tens ImageMagick instalado:

```bash
# Assumindo que tens logo.png (512x512)
convert logo.png -resize 192x192 pwa-192x192.png
convert logo.png -resize 512x512 pwa-512x512.png
convert logo.png -resize 180x180 apple-touch-icon.png
convert logo.png -resize 32x32 favicon.ico
```

## Requisitos de Design

- **Formato**: PNG (com transparência se desejado)
- **Fundo**: Branco ou cor principal do grupo
- **Logo**: Centrado, com margem (80% da área)
- **Estilo**: Simples e reconhecível em tamanhos pequenos

## Depois de Substituir

1. Limpa a cache do browser
2. Reinstala a PWA no telemóvel
3. Verifica se os ícones aparecem corretamente

## Exemplos de Logos

Para um grupo de padel, podes usar:
- 🎾 Emoji de ténis/padel
- 🏆 Troféu
- Logo do grupo (se existir)
- Iniciais do grupo em estilo minimalista

## Ferramentas Úteis

- **Figma** - Design online gratuito
- **Canva** - Templates prontos
- **GIMP** - Editor gratuito
- **Photopea** - Photoshop online gratuito

---

**Nota**: Os ficheiros placeholder atuais são apenas exemplos. 
Substitui-os com o logo real do vosso grupo!


