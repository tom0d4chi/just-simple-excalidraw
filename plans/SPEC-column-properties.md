# Spec — la colonne de propriétés (reconstruction sur 0.1.93)

Statut : à valider. Aucune ligne de code tant que ce document n'est pas accepté.
Base : tag `0.1.93` (commit `a6e9950`). Tout le reste (0.1.94 → 0.1.98) est mis de côté, pas
supprimé : l'historique reste, la reconstruction part de la base saine.

## 1. Le problème à résoudre

Sur mobile, quand quelque chose est sélectionné, la colonne continue d'afficher des outils de
dessin alors que l'intention est de modifier ce qui est sélectionné. La palette était un bouton
de plus, avec son sous-menu à deux niveaux.

## 2. Les états de la colonne

Trois états, et un seul à la fois.

S1 — Rien de sélectionné.
  Outils de dessin, comme en 0.1.93 : sélection multiple, crayon, formes, texte, image, gomme,
  puis annuler/rétablir. Aucun bouton de propriétés.

S2 — Sélection avec propriétés.
  La colonne affiche les propriétés applicables à la sélection, puis les actions, puis
  annuler/rétablir. Les outils de dessin ne sont pas affichés.

S3 — Sélection sans propriétés (une image, par exemple).
  La colonne reste en outils de dessin ; seules les actions contextuelles apparaissent en plus.

Le passage S1 ↔ S2 est le point le plus fragile de la version actuelle : il doit être défini
ici, pas découvert à l'usage. Règle : aucun élément ne doit apparaître ou clignoter à cet
instant ; un bouton qui n'existe plus disparaît, un bouton qui apparaît se pose, rien d'autre ne
bouge.

## 3. Les propriétés

Une propriété n'apparaît que si elle a un effet sur la sélection : trait, fond, épaisseur, style
de trait, coins, taille du texte. L'ordre est fixe et ne dépend pas du nombre de propriétés.

Chaque bouton de propriété montre la valeur courante (couleur, barre d'épaisseur, motif de
trait, coins, taille) — pas une icône générique. Un appui ouvre les valeurs de cette propriété,
un second appui les referme. Une seule propriété ouverte à la fois.

Sélection de plusieurs éléments : une propriété n'apparaît que si elle s'applique à tous. Si les
valeurs diffèrent, aucune valeur n'est marquée comme choisie.

## 4. Le panneau de valeurs

Ancré au bouton qui l'a ouvert, centré sur lui, ouvert vers la gauche, jamais hors de l'écran.
Il fait exactement la largeur de ses cases, sans défilement. Il se ferme : au second appui sur
son bouton, sur un appui hors du panneau, à la désélection, au changement d'outil.

Une seule mécanique de mouvement pour la colonne et tous ses panneaux, avec les valeurs déjà en
place dans la bande de formes (durée, courbe, plaque translucide adaptative, décalage d'entrée).
Le panneau des formes reste la référence : si une valeur doit changer, elle change aux deux
endroits ou nulle part.

## 5. Hors périmètre de cette version

- Pas d'accès direct à l'épaisseur ou à la couleur du crayon quand rien n'est sélectionné
  (question ouverte ci-dessous).
- Pas de nouveaux réglages, pas de nouvelles animations, pas de refonte du reste de la colonne.
- Pas de retour du pass d'animation annulé en 0.1.95.

## 6. Ce qui compte comme « fini »

Écrit avant le code, testé sur le téléphone, dans cet ordre :

1. Sans sélection, la colonne est identique, bouton pour bouton, à 0.1.93.
2. Sélectionner un rectangle affiche cinq propriétés ; une ligne, trois ; du texte, deux ; une
   image, aucune et les outils restent.
3. Chaque bouton de propriété montre la valeur réelle de l'élément sélectionné.
4. Un appui ouvre le panneau de cette propriété, ancré à son bouton, entièrement visible.
5. Choisir une valeur modifie l'élément, et le bouton de propriété reflète la nouvelle valeur.
6. Changer de propriété ouverte ne laisse ni décalage, ni clignotement, ni panneau fantôme.
7. Désélectionner rend les outils exactement comme en 0.1.93, sans flash.
8. Une plaque translucide apparaît derrière la colonne et derrière le panneau ouvert quand un
   élément passe dessous, avec la même apparence que celle de la bande de formes.
9. Aucun défilement parasite, aucune barre, aucun élément coupé, en portrait comme sur Fold
   déplié.
10. Rien de tout cela ne dépend de la vitesse ou de l'ordre des appuis : appuyer deux fois vite,
    changer de sélection pendant qu'un panneau est ouvert, ou sélectionner pendant l'entrée de
    la colonne donne le même résultat.

## 6 bis. Décisions actées

D1 — Dépliage d'un sous-menu : la dernière icône est en place à 140 ms, pas au-delà.
  Enveloppe 120 ms, courbe ease-out. Icônes 90 ms chacune, décalées de 10 ms en partant du
  bouton : la sixième (dernière) commence à 50 ms et finit à 140 ms. Repliement plus court que
  le dépliage, 100 ms.
  Constat de départ : la version en place prend 280 ms pour la dernière icône (enveloppe 140 ms,
  icônes 150 ms, écart 26 ms), ce qui est trop lent pour un menu qu'on ouvre et ferme souvent.

## 7. Méthode de travail

- Branche dédiée, une étape = un commit relu, aucune publication automatique.
- Un test de contrat (quels boutons, dans quel ordre, quel panneau ouvert) exécuté à chaque
  build : il doit nommer un bug avant que tu le voies.
- Une release seulement après ton essai sur le téléphone. Je n'annonce plus « vérifié » pour une
  animation que je n'ai pas regardée tourner.

## 8. Questions ouvertes

1. Crayon sans sélection : où régler son épaisseur et sa couleur ?
   a) nulle part dans cette version (on garde exactement 0.1.93)
   b) deux boutons ajoutés en bas de colonne quand le crayon est actif, sans masquer les outils
   c) on ne s'en occupe pas maintenant, à trancher après la première version

2. Ordre des propriétés, de haut en bas :
   a) coins, style, épaisseur, fond, trait (les couleurs en bas, près du pouce)
   b) trait, fond, épaisseur, style, coins (ordre de lecture)

3. Les actions : dupliquer et supprimer en bas, et « modifier le texte » ?
   a) les trois ensemble en bas, sous les propriétés
   b) modifier le texte reste avec les propriétés, dupliquer/supprimer en bas

4. Quand la sélection change de type pendant qu'un panneau est ouvert (rectangle → ligne) :
   a) le panneau se ferme
   b) il bascule sur la même famille si elle existe encore, sinon il se ferme
