// What a visitor finds when they sign in with the demo login (demo@demo.com / demo).
// Every visitor gets their own fresh copy of this, so nothing they change reaches anyone else.
// Recipes are written for the demo; photos are from Unsplash (see CREDITS.md).
"use strict";

const recipe = (key, title, image, text, extra = {}) => ({ key, title, image, text: text.trim(), ...extra });

const family = [
  recipe("penne", "Creamy tomato penne", "penne.jpg", `
A quick weeknight pasta in a smooth, mild tomato sauce that both kids finish.

Serves: 4  ·  Prep: 10 min  ·  Cook: 20 min

INGREDIENTS
- 400 g penne
- 1 tbsp olive oil
- 1 onion, finely chopped
- 2 cloves garlic, crushed
- 1 tin chopped tomatoes (400 g)
- 2 tbsp tomato purée
- 150 ml single cream
- 40 g parmesan, grated
- A handful of basil leaves

METHOD
1. Cook the penne in a big pan of salted water until just tender. Save a mug of the cooking water before draining.
2. Meanwhile, soften the onion in the olive oil over a medium heat for 8 minutes. Add the garlic for the last minute.
3. Stir in the tomatoes and purée and simmer for 10 minutes. Blend until smooth if your kids prefer it.
4. Take off the heat, stir in the cream and half the parmesan.
5. Toss the penne through the sauce, loosening it with a splash of the pasta water. Serve with the rest of the parmesan and torn basil.`,
    { notes: "Blend the sauce smooth for Theo, he picks out the onion.", planned: 7, added: 160, rate: { kmila: 1, ktheo: 1 } }),

  recipe("fajitas", "Chicken fajitas", "fajitas.jpg", `
Everyone builds their own at the table, so it suits picky and adventurous eaters alike.

Serves: 4  ·  Prep: 15 min  ·  Cook: 15 min

INGREDIENTS
- 3 chicken breasts, sliced into strips
- 2 peppers (red and yellow), sliced
- 1 red onion, sliced
- 2 tsp smoked paprika
- 1 tsp ground cumin
- 1 lime
- 2 tbsp olive oil
- 8 small flour tortillas
- Soured cream, grated cheese and salsa to serve

METHOD
1. Toss the chicken with the paprika, cumin, the juice of half the lime, a pinch of salt and 1 tbsp of the oil.
2. Heat a large frying pan until very hot. Cook the chicken for 6 to 7 minutes until golden and cooked through, then lift it out.
3. Add the rest of the oil, then the peppers and onion. Cook for 5 minutes until soft at the edges but still bright.
4. Return the chicken, squeeze over the rest of the lime and toss.
5. Warm the tortillas and put everything on the table so each person can fill and roll their own.`,
    { planned: 5, added: 140, rate: { kmila: 1, ktheo: 0 } }),

  recipe("chickpea-curry", "Chickpea and sweet potato curry", "chickpea-curry.jpg", `
A mild, creamy curry that is easy to make ahead and freezes well.

Serves: 4  ·  Prep: 15 min  ·  Cook: 30 min

INGREDIENTS
- 1 tbsp vegetable oil
- 1 onion, chopped
- 2 cloves garlic, crushed
- A thumb of ginger, grated
- 2 tbsp mild curry paste
- 2 sweet potatoes, peeled and cubed
- 2 tins chickpeas, drained
- 1 tin coconut milk (400 ml)
- 200 g spinach
- Rice and naan to serve

METHOD
1. Soften the onion in the oil for 5 minutes, then add the garlic, ginger and curry paste and stir for a minute.
2. Add the sweet potato, chickpeas, coconut milk and half a tin of water. Simmer for 20 minutes until the potato is tender.
3. Stir in the spinach until it wilts. Season with salt and a squeeze of lemon if you have one.
4. Serve with rice and warm naan. Add chilli at the table for the grown ups.`,
    { notes: "Theo gets his before the chilli goes in.", planned: 3, added: 90, rate: { kmila: 0, ktheo: -1 } }),

  recipe("shakshuka", "Shakshuka", "shakshuka.jpg", `
Eggs gently cooked in a spiced tomato and pepper sauce. Lovely with crusty bread for dipping.

Serves: 4  ·  Prep: 10 min  ·  Cook: 25 min

INGREDIENTS
- 2 tbsp olive oil
- 1 onion, sliced
- 2 red peppers, sliced
- 2 cloves garlic, crushed
- 1 tsp ground cumin
- 1 tsp sweet paprika
- 2 tins chopped tomatoes
- 6 eggs
- 50 g feta
- Parsley and crusty bread to serve

METHOD
1. Cook the onion and peppers in the oil in a wide pan for 10 minutes until soft.
2. Add the garlic and spices for a minute, then the tomatoes. Simmer for 10 minutes until thick.
3. Make six hollows in the sauce and crack an egg into each. Cover and cook on a low heat for 6 to 8 minutes, until the whites are set.
4. Crumble over the feta, scatter with parsley and bring the pan to the table with the bread.`,
    { planned: 2, added: 75, rate: { kmila: -1, ktheo: 0 } }),

  recipe("mac-cheese", "Mac and cheese with peas", "mac-cheese.jpg", `
The stovetop kind, ready in the time it takes the pasta to cook. Peas hide in it nicely.

Serves: 4  ·  Prep: 10 min  ·  Cook: 25 min

INGREDIENTS
- 350 g macaroni
- 150 g frozen peas
- 40 g butter
- 40 g plain flour
- 600 ml milk
- 1 tsp mustard
- 200 g mature cheddar, grated

METHOD
1. Cook the macaroni, adding the peas for the last 2 minutes. Drain.
2. Melt the butter in a pan, stir in the flour and cook for a minute.
3. Whisk in the milk a little at a time and keep stirring until smooth and thick.
4. Take off the heat and stir in the mustard and most of the cheese until melted.
5. Fold in the pasta and peas. Top with the rest of the cheese and grill for 5 minutes if you want a golden top.`,
    { planned: 6, added: 150, rate: { kmila: 0, ktheo: 1 } }),

  recipe("oats", "Overnight oats", "oats.jpg", `
Made the night before, so breakfast is ready when everyone comes downstairs.

Serves: 2  ·  Prep: 5 min

INGREDIENTS
- 100 g rolled oats
- 200 ml milk
- 4 tbsp natural yoghurt
- 1 tbsp honey
- 1 tbsp chia seeds
- A handful of raspberries

METHOD
1. Stir the oats, milk, yoghurt, honey and chia seeds together.
2. Divide between two jars, cover and leave in the fridge overnight.
3. In the morning, loosen with a splash of milk and top with raspberries.`,
    { planned: 9, added: 120, rate: { kmila: 0, ktheo: 1 } }),

  recipe("pancakes", "Fluffy pancakes", "pancakes.jpg", `
Saturday morning pancakes. The batter takes five minutes and the kids love to help.

Serves: 4  ·  Prep: 10 min  ·  Cook: 20 min

INGREDIENTS
- 200 g self-raising flour
- 1 tsp baking powder
- 1 tbsp sugar
- 2 eggs
- 250 ml milk
- 1 tbsp melted butter, plus a little for the pan
- Berries and maple syrup to serve

METHOD
1. Mix the flour, baking powder and sugar in a bowl.
2. Whisk the eggs and milk together, pour into the flour and whisk until just smooth. Stir in the melted butter.
3. Heat a frying pan over a medium heat with a little butter. Add small ladles of batter.
4. Flip when bubbles appear on top, after about 2 minutes, then cook for 1 minute more.
5. Keep warm in a low oven while you cook the rest. Serve stacked with berries and syrup.`,
    { planned: 8, added: 170, rate: { kmila: 1, ktheo: 1 } }),

  recipe("bolognese", "Spaghetti bolognese", "bolognese.jpg", `
A slow simmered family favourite. Make the big batch and freeze half for a busy night.

Serves: 6  ·  Prep: 15 min  ·  Cook: 1 hr

INGREDIENTS
- 1 tbsp olive oil
- 1 onion, finely chopped
- 1 carrot, finely chopped
- 1 celery stick, finely chopped
- 2 cloves garlic, crushed
- 500 g beef mince
- 2 tbsp tomato purée
- 2 tins chopped tomatoes
- 1 tsp dried oregano
- 500 g spaghetti
- Parmesan to serve

METHOD
1. Soften the onion, carrot and celery in the oil for 10 minutes. Add the garlic for the last minute.
2. Turn up the heat, add the mince and brown it well, breaking it up as it cooks.
3. Stir in the purée, tomatoes, oregano and a small glass of water. Simmer gently for 45 minutes, stirring now and then.
4. Cook the spaghetti, drain and toss with the sauce. Serve with parmesan.`,
    { notes: "Double batch, freeze half for a busy night.", planned: 9, added: 175, rate: { kmila: 1, ktheo: 1 } }),

  recipe("fish-tacos", "Fish tacos with crunchy slaw", "fish-tacos.jpg", `
Crispy fish, crunchy slaw and creamy avocado in soft tortillas.

Serves: 4  ·  Prep: 15 min  ·  Cook: 10 min

INGREDIENTS
- 4 white fish fillets (cod or haddock)
- 3 tbsp plain flour
- 1 tsp smoked paprika
- 2 tbsp oil
- 8 small tortillas
- 1/4 red cabbage, finely shredded
- 1 ripe avocado
- 4 tbsp natural yoghurt
- 1 lime

METHOD
1. Mix the flour with the paprika and a pinch of salt. Cut the fish into strips and dust them in the flour.
2. Fry the fish in the oil for 2 to 3 minutes on each side until golden and cooked through.
3. Toss the cabbage with the juice of half the lime and a pinch of salt.
4. Mash the avocado with the yoghurt and the rest of the lime.
5. Warm the tortillas and fill with the slaw, fish and a spoonful of the avocado sauce.`,
    { notes: "Mila always wants extra lime.", planned: 3, added: 60, rate: { kmila: 1, ktheo: -1 } }),

  recipe("pizza", "Homemade pizza", "pizza.jpg", `
Friday pizza night. Everyone rolls out their own base and picks their own toppings.

Makes: 4 small pizzas  ·  Prep: 20 min  ·  Rise: 1 hr  ·  Cook: 12 min

INGREDIENTS
- 500 g strong white bread flour
- 7 g sachet fast-action yeast
- 1 tsp salt
- 325 ml warm water
- 2 tbsp olive oil
- 200 ml passata
- 250 g mozzarella
- Toppings such as ham, peppers, sweetcorn, olives or mushrooms

METHOD
1. Mix the flour, yeast and salt. Add the water and oil and bring together into a soft dough.
2. Knead for 10 minutes until smooth, then cover and leave to rise for an hour.
3. Heat the oven to 240°C (fan 220°C) with the baking trays inside.
4. Divide the dough into four and roll out thinly. Spread with passata, tear over the mozzarella and add the toppings.
5. Bake for 10 to 12 minutes until crisp and bubbling.`,
    { notes: "The dough can rise in the fridge from the morning.", planned: 12, added: 180, rate: { kmila: 1, ktheo: 1 } }),

  recipe("chicken-soup", "Chicken noodle soup", "chicken-soup.jpg", `
Gentle and warming. The one everyone asks for when they have a cold.

Serves: 4  ·  Prep: 15 min  ·  Cook: 30 min

INGREDIENTS
- 1 tbsp olive oil
- 1 onion, chopped
- 2 carrots, sliced
- 2 celery sticks, sliced
- 1.5 litres chicken stock
- 2 chicken breasts
- 100 g thin egg noodles
- 100 g frozen sweetcorn
- A small bunch of parsley, chopped

METHOD
1. Soften the onion, carrot and celery in the oil for 8 minutes.
2. Pour in the stock, add the whole chicken breasts and simmer gently for 15 minutes until cooked.
3. Lift out the chicken and shred it with two forks.
4. Add the noodles and sweetcorn to the pan and cook for 4 minutes.
5. Return the chicken, season and stir through the parsley.`,
    { planned: 4, added: 100, rate: { kmila: 1, ktheo: 0 } }),

  recipe("banana-bread", "Banana bread", "banana-bread.jpg", `
The best use for the brown bananas in the fruit bowl. Good for lunch boxes.

Makes: 1 loaf  ·  Prep: 10 min  ·  Cook: 1 hr

INGREDIENTS
- 3 very ripe bananas
- 100 g butter, melted
- 100 g light brown sugar
- 2 eggs
- 225 g self-raising flour
- 1 tsp cinnamon
- 50 g chocolate chips (optional)

METHOD
1. Heat the oven to 180°C (fan 160°C) and line a 900 g loaf tin.
2. Mash the bananas, then stir in the butter, sugar and eggs.
3. Fold in the flour and cinnamon, then the chocolate chips if using.
4. Pour into the tin and bake for 50 to 60 minutes, until a skewer comes out clean.
5. Cool in the tin for 10 minutes before turning out.`,
    { planned: 4, added: 130, rate: { kmila: 1, ktheo: 1 } }),

  recipe("lentil-soup", "Red lentil and carrot soup", "lentil-soup.jpg", `
Cheap, filling and ready in half an hour. Great with buttered toast.

Serves: 4  ·  Prep: 10 min  ·  Cook: 25 min

INGREDIENTS
- 1 tbsp olive oil
- 1 onion, chopped
- 4 carrots, grated
- 1 tsp ground cumin
- 150 g red lentils, rinsed
- 1 litre vegetable stock
- 100 ml milk
- Crusty bread to serve

METHOD
1. Soften the onion in the oil for 5 minutes, then add the carrots and cumin for 2 minutes more.
2. Add the lentils and stock. Simmer for 20 minutes until the lentils are soft.
3. Blend until smooth, stir in the milk and season to taste.
4. Serve with crusty bread or buttered toast.`,
    { planned: 2, added: 45, rate: { kmila: 0, ktheo: 0 } }),

  recipe("omelette", "Spinach and cheese omelette", "omelette.jpg", `
A five minute lunch when the fridge is looking empty.

Serves: 2  ·  Prep: 5 min  ·  Cook: 5 min

INGREDIENTS
- 4 eggs
- A knob of butter
- 2 handfuls of baby spinach
- 30 g cheddar or feta
- Toast to serve

METHOD
1. Beat the eggs with a pinch of salt and pepper.
2. Melt the butter in a frying pan, add the spinach and stir until it just wilts.
3. Pour in the eggs and move them gently around the pan until almost set.
4. Scatter over the cheese, fold in half and slide onto a plate. Repeat for the second omelette.`,
    { planned: 1, added: 20 }),

  recipe("salmon-traybake", "Salmon and lemon potato traybake", "salmon-traybake.jpg", `
One tray and very little washing up. The potatoes go crispy at the edges.

Serves: 4  ·  Prep: 10 min  ·  Cook: 40 min

INGREDIENTS
- 800 g baby potatoes, halved
- 2 tbsp olive oil
- 1 lemon
- 4 salmon fillets
- 200 g green beans
- 250 g cherry tomatoes
- A few sprigs of dill

METHOD
1. Heat the oven to 200°C (fan 180°C). Toss the potatoes with the oil and some salt on a large tray and roast for 25 minutes.
2. Add the green beans and tomatoes and nestle the salmon among them.
3. Slice the lemon thinly and lay a slice on each fillet. Roast for 12 to 15 minutes more.
4. Scatter with dill and serve straight from the tray.`,
    { planned: 4, added: 110, rate: { kmila: 1, ktheo: 0 } }),

  recipe("noodles", "Veggie noodle stir-fry", "noodles.jpg", `
Fast, colourful and a good way to use up odds and ends of veg.

Serves: 4  ·  Prep: 15 min  ·  Cook: 10 min

INGREDIENTS
- 300 g egg noodles
- 1 tbsp sesame oil
- 1 red pepper, sliced
- 1 carrot, cut into thin strips
- 1 head of pak choi, sliced
- 100 g mangetout
- 3 spring onions, sliced
- 3 tbsp soy sauce
- 1 tbsp honey
- 1 tbsp sesame seeds

METHOD
1. Cook the noodles following the pack, then drain and rinse under cold water.
2. Heat the oil in a wok and stir-fry the pepper and carrot for 3 minutes.
3. Add the pak choi, mangetout and spring onions for 2 minutes more.
4. Add the noodles with the soy sauce and honey and toss until hot through.
5. Scatter with sesame seeds to serve.`,
    { planned: 3, added: 30 }),
];

// The plan, by week relative to the visitor's own today: [day 0-6 from Monday, slot, recipe key, note].
// Meals on days before today count as cooked; today's dinner becomes the "Tonight" card.
const weeks = {
  "-1": [[0, "dinner", "bolognese"], [1, "dinner", "shakshuka"], [2, "dinner", "mac-cheese"], [3, "dinner", "noodles"],
    [4, "dinner", "pizza"], [5, "breakfast", "pancakes"], [5, "dinner", "penne"], [6, "dinner", "chicken-soup"]],
  "0": [[0, "breakfast", "oats"], [0, "dinner", "chicken-soup"], [1, "dinner", "fajitas"], [2, "breakfast", "oats"],
    [2, "dinner", "salmon-traybake"], [3, "dinner", "penne"], [3, "snack", "banana-bread", "Bake a double loaf and freeze one"],
    [4, "dinner", "pizza", "Kids pick their own toppings"], [5, "breakfast", "pancakes"], [5, "lunch", "omelette"],
    [5, "dinner", "fish-tacos"], [6, "lunch", "lentil-soup"], [6, "dinner", "chickpea-curry", "Cook double and freeze half"]],
  "1": [[0, "dinner", "bolognese"], [2, "dinner", "noodles"], [4, "dinner", "pizza"], [5, "breakfast", "pancakes"]],
};

// Two pretend members whose shared recipes fill the demo's "Everyone" tab.
const friends = [
  { id: "demofriend_priya", name: "Priya", recipes: [
    recipe("dal", "Weeknight dal", "dal.jpg", `
My mum's everyday dal. Comforting, cheap, and the kids eat it with a spoon.

Serves: 4  ·  Prep: 10 min  ·  Cook: 35 min

INGREDIENTS
- 250 g red lentils, rinsed
- 1 litre water
- 1 tsp turmeric
- 2 tbsp butter or ghee
- 1 tsp cumin seeds
- 1 onion, finely chopped
- 3 cloves garlic, sliced
- 2 tomatoes, chopped
- Coriander and basmati rice to serve

METHOD
1. Simmer the lentils in the water with the turmeric for 25 minutes, stirring now and then, until soft and creamy.
2. Meanwhile, melt the butter in a frying pan and fry the cumin seeds for 30 seconds.
3. Add the onion and cook until golden, then the garlic and tomatoes for 5 minutes.
4. Stir this into the lentils, season with salt and simmer for 5 minutes more.
5. Serve over rice with chopped coriander.`, { added: 12 }),
    recipe("squash-orzo", "Roast squash orzo", "squash-orzo.jpg", `
Sweet roasted squash stirred through creamy orzo. A risotto without all the stirring.

Serves: 4  ·  Prep: 15 min  ·  Cook: 35 min

INGREDIENTS
- 1 small butternut squash, cut into chunks
- 2 tbsp olive oil
- 1 onion, chopped
- 300 g orzo
- 900 ml vegetable stock
- 50 g parmesan, grated
- A few sage leaves

METHOD
1. Roast the squash with 1 tbsp of the oil at 200°C (fan 180°C) for 30 minutes until soft and golden.
2. Meanwhile, soften the onion in the rest of the oil, then add the orzo and stir for a minute.
3. Add the stock and simmer for 10 to 12 minutes, stirring often, until the orzo is tender and creamy.
4. Stir in the parmesan and half the squash, mashing it in a little. Top with the rest of the squash and crisp sage leaves.`, { added: 26 }),
    recipe("crumble", "Apple crumble", "crumble.jpg", `
Sunday pudding. Lovely with custard or a scoop of ice cream.

Serves: 6  ·  Prep: 20 min  ·  Cook: 40 min

INGREDIENTS
- 6 eating apples, peeled and sliced
- 2 tbsp sugar
- 1 tsp cinnamon
- 175 g plain flour
- 100 g cold butter, cubed
- 75 g demerara sugar
- 50 g rolled oats

METHOD
1. Heat the oven to 190°C (fan 170°C). Toss the apples with the sugar and cinnamon in a baking dish.
2. Rub the butter into the flour with your fingertips until it looks like breadcrumbs.
3. Stir in the demerara sugar and oats, then scatter over the apples.
4. Bake for 35 to 40 minutes until golden and bubbling at the edges.`, { added: 40 }),
  ] },
  { id: "demofriend_tom", name: "Tom", recipes: [
    recipe("fish-bake", "Crispy topped fish bake", "fish-bake.jpg", `
All the comfort of a fish pie in half the time.

Serves: 4  ·  Prep: 15 min  ·  Cook: 25 min

INGREDIENTS
- 600 g white fish fillets
- 150 g frozen peas
- 200 g crème fraîche
- 1 tbsp Dijon mustard
- 1 lemon
- 60 g fresh breadcrumbs
- 40 g cheddar, grated
- A small bunch of parsley, chopped

METHOD
1. Heat the oven to 200°C (fan 180°C).
2. Mix the crème fraîche and mustard with the zest and juice of the lemon and a pinch of salt.
3. Lay the fish and peas in a baking dish and spoon over the sauce.
4. Mix the breadcrumbs, cheese and parsley and scatter over the top.
5. Bake for 20 to 25 minutes until the fish flakes easily and the top is crisp.`, { added: 8 }),
    recipe("coconut-curry", "Coconut chicken curry", "coconut-curry.jpg", `
Fragrant and gentle. Add sliced chilli at the end for anyone who likes it hot.

Serves: 4  ·  Prep: 15 min  ·  Cook: 25 min

INGREDIENTS
- 1 tbsp vegetable oil
- 2 tbsp Thai green curry paste
- 4 chicken thighs, sliced
- 1 tin coconut milk (400 ml)
- 200 ml chicken stock
- 2 carrots, sliced
- 150 g green beans
- 1 lime
- Jasmine rice to serve

METHOD
1. Fry the curry paste in the oil for a minute until fragrant.
2. Add the chicken and stir to coat, then pour in the coconut milk and stock.
3. Add the carrots and simmer for 15 minutes, then the beans for 5 minutes more.
4. Squeeze in the lime and serve over rice.`, { added: 19 }),
    recipe("muffins", "Blueberry muffins", "muffins.jpg", `
Weekend baking with the kids. They freeze well for lunch boxes.

Makes: 12  ·  Prep: 15 min  ·  Cook: 22 min

INGREDIENTS
- 300 g self-raising flour
- 1 tsp baking powder
- 150 g caster sugar
- 2 eggs
- 200 ml milk
- 100 g butter, melted
- 150 g blueberries

METHOD
1. Heat the oven to 200°C (fan 180°C) and line a 12 hole muffin tin.
2. Mix the flour, baking powder and sugar in a big bowl.
3. Whisk the eggs, milk and butter, then stir gently into the dry mix. A few lumps are fine.
4. Fold in the blueberries and spoon into the cases.
5. Bake for 20 to 22 minutes until risen and golden.`, { added: 33 }),
  ] },
];

module.exports = {
  name: "Demo family",
  kids: [{ id: "kmila", name: "Mila" }, { id: "ktheo", name: "Theo" }],
  family, weeks, friends,
};
