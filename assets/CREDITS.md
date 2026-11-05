# Créditos da arte

A arte do mapa (pisos, paredes, escadas, baú, portas, herói e inimigos) vem dos pacotes de
pixel art de **Pixel_Poem**:

- 2D Pixel Dungeon Asset Pack: https://pixel-poem.itch.io/dungeon-assetpuck
  (arquivos usados: `Dungeon_Tileset_v2.png`, `Dungeon_item_props_v2.png`, `chest_1.png`
  e `Dungeon_Character.png`)
- Enemy Animations Set (esqueletos e vampiro): `enemies-*_idle.png` e `enemies-*_take_damage.png`.
  Este pacote veio numa pasta de downloads sem texto de licença, então confirme a origem e os termos.

Termos de uso conforme a descrição da página do autor (lida em 2026-11-05): o pacote pode ser
usado em projetos gratuitos e comerciais, pode ser modificado, **crédito não é obrigatório, mas é
apreciado**, e **não pode ser redistribuído nem revendido**. Num comentário o autor respondeu que
é possível hospedar os arquivos num repositório público do GitHub, o que não bate com a descrição:
em caso de dúvida, pergunte a ele.

Os arquivos estão copiados em `assets/pixel/`, sem alterações, exceto `Dungeon_Tileset_v2_alpha.png`,
uma cópia de `Dungeon_Tileset_v2.png` com o fundo escuro transparente (gerada por
`scripts/tileset_alpha.py`), para poder empilhar peças de parede numa mesma casa. Só foram copiadas as imagens
realmente usadas pelo jogo, não os pacotes inteiros.
