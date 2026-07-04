export const SIMPLE_FOODS = [
  // Fruits
  { keywords:["banane", "banana"], name:"Banane", category:"fruit", calories:90, protein:1.1, carbs:19.7, fat:0.3, fiber:1.9 },
  { keywords:["pomme", "apple"], name:"Pomme", category:"fruit", calories:54, protein:0.3, carbs:11.6, fat:0.2, fiber:2.4 },
  { keywords:["poire", "pear"], name:"Poire", category:"fruit", calories:57, protein:0.4, carbs:12.0, fat:0.3, fiber:3.1 },
  { keywords:["clementine", "clémentine", "mandarine"], name:"Clémentine", category:"fruit", calories:47, protein:0.8, carbs:9.2, fat:0.2, fiber:1.7 },
  { keywords:["peche", "pêche", "peach"], name:"Pêche", category:"fruit", calories:46, protein:0.9, carbs:9.5, fat:0.3, fiber:1.5 },
  { keywords:["brugnon", "nectarine"], name:"Brugnon", category:"fruit", calories:51, protein:1.1, carbs:10.6, fat:0.3, fiber:1.7 },
  { keywords:["fraise", "fraises", "strawberry", "strawberries"], name:"Fraises", category:"fruit", calories:38, protein:0.6, carbs:6.0, fat:0.3, fiber:2.0 },
  { keywords:["framboise", "framboises", "raspberry", "raspberries"], name:"Framboises", category:"fruit", calories:49, protein:1.2, carbs:5.8, fat:0.6, fiber:6.1 },
  { keywords:["myrtille", "myrtilles", "blueberry", "blueberries"], name:"Myrtilles fraîches", category:"fruit", calories:57, protein:0.7, carbs:14.5, fat:0.3, fiber:2.4 },

  // Légumes simples
  { keywords:["courgette", "courgettes", "zucchini"], name:"Courgette cuite", category:"legume", calories:16, protein:1.2, carbs:2.0, fat:0.3, fiber:1.1 },
  { keywords:["carotte", "carottes", "carrot"], name:"Carotte cuite", category:"legume", calories:36, protein:0.8, carbs:6.6, fat:0.2, fiber:2.8 },
  { keywords:["haricot vert", "haricots verts", "green beans"], name:"Haricots verts cuits", category:"legume", calories:30, protein:1.9, carbs:4.1, fat:0.2, fiber:3.2 },
  { keywords:["tomate", "tomates", "tomato"], name:"Tomate", category:"legume", calories:19, protein:0.9, carbs:2.5, fat:0.2, fiber:1.2 },
  { keywords:["concombre", "cucumber"], name:"Concombre", category:"legume", calories:14, protein:0.6, carbs:1.6, fat:0.1, fiber:0.7 },
  { keywords:["salade", "salade verte", "lettuce"], name:"Salade verte", category:"legume", calories:15, protein:1.2, carbs:1.4, fat:0.2, fiber:1.5 },
  { keywords:["brocoli", "brocolis", "broccoli"], name:"Brocoli cuit", category:"legume", calories:35, protein:2.4, carbs:2.2, fat:0.4, fiber:3.0 },
  { keywords:["chou fleur", "chou-fleur", "cauliflower"], name:"Chou-fleur cuit", category:"legume", calories:27, protein:2.0, carbs:2.3, fat:0.3, fiber:2.4 },
  { keywords:["potimarron", "courge", "pumpkin"], name:"Potimarron cuit", category:"legume", calories:38, protein:1.0, carbs:7.3, fat:0.3, fiber:1.7 },
  { keywords:["champignon", "champignons", "mushroom"], name:"Champignons cuits", category:"legume", calories:28, protein:3.1, carbs:1.3, fat:0.4, fiber:1.8 },

  // Féculents simples
  { keywords:["pomme de terre", "pommes de terre", "patate", "potato"], name:"Pomme de terre cuite", category:"feculent", calories:80, protein:1.8, carbs:17.0, fat:0.1, fiber:1.8 },
  { keywords:["patate douce", "sweet potato"], name:"Patate douce cuite", category:"feculent", calories:86, protein:1.6, carbs:18.1, fat:0.1, fiber:3.0 },
  { keywords:["riz", "riz cuit", "riz blanc", "rice"], name:"Riz blanc cuit", category:"feculent", calories:130, protein:2.7, carbs:28.2, fat:0.3, fiber:0.4 },
  { keywords:["pates", "pâtes", "pates cuites", "pâtes cuites", "pasta"], name:"Pâtes cuites", category:"feculent", calories:150, protein:5.0, carbs:30.0, fat:1.1, fiber:1.8 },
  { keywords:["quinoa", "quinoa cuit"], name:"Quinoa cuit", category:"feculent", calories:120, protein:4.4, carbs:21.3, fat:1.9, fiber:2.8 },
  { keywords:["semoule", "semoule cuite", "couscous"], name:"Semoule cuite", category:"feculent", calories:112, protein:3.8, carbs:23.2, fat:0.2, fiber:1.4 },
  { keywords:["pain complet", "pain", "whole wheat bread"], name:"Pain complet", category:"feculent", calories:247, protein:9.0, carbs:41.0, fat:3.5, fiber:7.0 },
  { keywords:["avoine", "flocons avoine", "flocons d avoine", "flocons d’avoine", "oats"], name:"Flocons d’avoine", category:"feculent", calories:367, protein:13.5, carbs:58.0, fat:7.0, fiber:10.0 },

  // Protéines simples
  { keywords:["oeuf", "œuf", "oeufs", "œufs", "egg"], name:"Œuf entier", category:"proteine", calories:140, protein:12.5, carbs:0.7, fat:9.8, fiber:0 },
  { keywords:["poulet", "blanc de poulet", "chicken breast"], name:"Blanc de poulet cuit", category:"proteine", calories:165, protein:31.0, carbs:0, fat:3.6, fiber:0 },
  { keywords:["jambon", "jambon blanc", "ham"], name:"Jambon blanc", category:"proteine", calories:120, protein:20.0, carbs:1.0, fat:4.0, fiber:0 },
  { keywords:["steak", "steak hache", "steak haché", "steak 5", "boeuf hache", "bœuf haché"], name:"Steak haché 5% cuit", category:"proteine", calories:155, protein:26.0, carbs:0, fat:5.0, fiber:0 },
  { keywords:["saumon", "salmon"], name:"Saumon cuit", category:"proteine", calories:206, protein:22.0, carbs:0, fat:12.0, fiber:0 },
  { keywords:["cabillaud", "cod"], name:"Cabillaud cuit", category:"proteine", calories:82, protein:18.0, carbs:0, fat:0.7, fiber:0 },

  // Produits laitiers / assimilés
  { keywords:["fromage blanc", "fromage blanc 0", "fromage blanc 0%"], name:"Fromage blanc 0%", category:"laitier", calories:45, protein:8.0, carbs:3.8, fat:0.2, fiber:0 },
  { keywords:["skyr", "skyr nature"], name:"Skyr nature", category:"laitier", calories:60, protein:10.0, carbs:3.5, fat:0.2, fiber:0 },
  { keywords:["yaourt nature", "yaourt", "yogurt"], name:"Yaourt nature", category:"laitier", calories:61, protein:3.5, carbs:4.7, fat:3.3, fiber:0 },
  { keywords:["lait", "lait demi ecreme", "lait demi-écrémé", "semi skimmed milk"], name:"Lait demi-écrémé", category:"laitier", calories:47, protein:3.3, carbs:4.8, fat:1.6, fiber:0 },
  { keywords:["lait amande", "lait d amande", "lait d’amande", "amande sans sucre", "almond milk"], name:"Lait d’amande non sucré", category:"laitier", calories:15, protein:0.5, carbs:0.3, fat:1.2, fiber:0.4 },
  { keywords:["mozzarella", "mozza"], name:"Mozzarella", category:"laitier", calories:260, protein:18.0, carbs:2.0, fat:20.0, fiber:0 },

  // Légumineuses / végétal
  { keywords:["lentille", "lentilles", "lentilles cuites"], name:"Lentilles cuites", category:"legumineuse", calories:116, protein:9.0, carbs:16.0, fat:0.4, fiber:8.0 },
  { keywords:["pois chiche", "pois chiches", "chickpeas"], name:"Pois chiches cuits", category:"legumineuse", calories:164, protein:8.9, carbs:20.8, fat:2.6, fiber:7.6 },
  { keywords:["haricot rouge", "haricots rouges", "kidney beans"], name:"Haricots rouges cuits", category:"legumineuse", calories:127, protein:8.7, carbs:16.7, fat:0.5, fiber:6.4 },
  { keywords:["edamame", "edamames"], name:"Edamame", category:"legumineuse", calories:121, protein:11.9, carbs:8.9, fat:5.2, fiber:5.2 },

  // Matières grasses / extras utiles
  { keywords:["avocat", "avocado"], name:"Avocat", category:"extra", calories:160, protein:2.0, carbs:3.7, fat:14.7, fiber:6.7 },
  { keywords:["huile olive", "huile d olive", "huile d’olive", "olive oil"], name:"Huile d’olive", category:"extra", calories:884, protein:0, carbs:0, fat:100.0, fiber:0 },
  { keywords:["beurre", "butter"], name:"Beurre", category:"extra", calories:717, protein:0.8, carbs:0.1, fat:81.0, fiber:0 },
  { keywords:["beurre cacahuete", "beurre cacahuète", "beurre de cacahuete", "beurre de cacahuète", "peanut butter", "puree cacahuete", "purée cacahuète", "sans sucre ajoute", "sans sucre ajouté"], name:"Beurre de cacahuète sans sucre ajouté", category:"extra", calories:610, protein:26.0, carbs:12.0, fat:50.0, fiber:8.0 }
].map((food) => ({
  ...food,
  brand:"· Aliment simple",
  barcode:"",
  simple:true,
  source:"simpleFoodBase"
}));
