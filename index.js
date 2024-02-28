const express = require("express");
const cors = require("cors");
const fs = require("fs");
const short = require("short-uuid");
const products = require("./products");
const categories = require("./categories");

const app = express();

app.use(cors());
app.use(express.json());

const getProducts = () => {
  return products.products;
};

const getProduct = (productId) => {
  const prodList = products.products;
  if (prodList.length > 0) {
    for (item of prodList) {
      if (item.id === productId) {
        return item;
      }
    }
  }
  return null;
};

const getCategories = () => {
  return Object.keys(categories.categories);
};

const getProductsByCategory = (category) => {
  if (getCategories().includes(category)) {
    return categories.categories[category];
  } else {
    return null;
  }
};

const addProduct = (product) => {
  // check if product list is already in the list
  if (!products.products.some((item) => item.id === product.id)) {
    // add the new product to the products
    products.products.push(product);
    fs.writeFile("products.json", JSON.stringify(products), (err) => {
      if (err) throw err;
    });

    // add the new product to its category
    if (categories.categories[product.category]) {
      categories.categories[product.category].push(product);
    } else {
      categories.categories[product.category] = [product];
    }
    fs.writeFile("categories.json", JSON.stringify(categories), (err) => {
      if (err) throw err;
    });
    return 1; // indicates a successful addition
  } else {
    return -1; // indicates failure either due to empty product list or product already is in the list
  }
};

// update the indicated product's stock by the value of stockChange. if stockChange is negative the total stock will decrease and if it is positive the total stock will increase.
const updateProductStock = (productId, stockChange) => {
  if (getProduct(productId)) {
    for (i in products.products) {
      const prod = products.products[i];
      if (prod.id === productId) {
        if (stockChange < 0 && prod.stock < -stockChange) {
          return { success: false, product: prod.title, oldStock: prod.stock }; // stock cannot be updated as we are reducing by more than we have left
        } else {
          products.products[i].stock += stockChange;
          fs.writeFile("products.json", JSON.stringify(products), (err) => {
            if (err) throw err;
          });
          fs.writeFile("categories.json", JSON.stringify(categories), (err) => {
            if (err) throw err;
          });

          return {
            success: true,
            product: prod.title,
            newStock: products.products[i].stock,
          }; // stock successfully updated
        }
      }
    }
  }

  return null; // can't find product
};

const removeProduct = (productId) => {
  const prodList = products.products;
  if (prodList.length > 0) {
    for (i in prodList) {
      const prod = prodList[i];
      if (prod.id === productId) {
        // remove from products
        products.products.splice(i, 1);
        fs.writeFile("products.json", JSON.stringify(products), (err) => {
          if (err) throw err;
        });

        // remove from category
        const catInd = categories.categories[prod.category].indexOf(prod);
        categories.categories[prod.category].splice(catInd, 1);
        fs.writeFile("categories.json", JSON.stringify(categories), (err) => {
          if (err) throw err;
        });

        return prod;
      }
    }
  }

  return null;
};

const addCategory = (category) => {
  if (category in categories.categories) {
    return -1; // category is already added
  } else {
    categories.categories[category] = [];
    fs.writeFile("categories.json", JSON.stringify(categories), (err) => {
      if (err) throw err;
      return 1; // category is successfully added
    });
  }
};

const removeCategory = (category) => {
  if (categories.categories[category].length > 0) {
    return -1; // cannot remove category because there are items in the category
  } else {
    if (categories.categories[category]) {
      delete categories.categories[category];
      fs.writeFile("categories.json", JSON.stringify(categories), (err) => {
        if (err) throw err;
      });
      return 1; // successfully removed category
    } else {
      return null; // category isn't found
    }
  }
};

app.get("/api/products/all-products", (_, res) => {
  res.send(getProducts());
});

app.get("/api/products/product", (req, res) => {
  const product = getProduct(req.query.id);

  if (product) {
    res.send(product);
  } else {
    res.send("product not found");
  }
});

app.get("/api/products/categories", (_, res) => {
  res.send(getCategories());
});

app.get("/api/products/category", (req, res) => {
  const prods = getProductsByCategory(req.query.category);
  if (prods) {
    res.send(prods);
  } else {
    res.send("category not found");
  }
});

/*
What a product may look like in the json:
{
  "id": 2345,
  "title": "Yellow yarn",
  "price": 10.99,
  "description": "A ball of yellow yarn",
  "category": "yarn",
  "image": "www.imageurl.com",
  "rating": { "rate": 3, "count": 12 },
  "stock": 12
}
*/

app.post("/api/products/add-product", (req, res) => {
  const product = {
    id: short.generate(),
    title: req.query.title,
    price: Number(req.query.price),
    description: req.query.description,
    category: req.query.category,
    image: req.query.image,
    rating: {
      rate: Number(req.query.rate),
      count: Number(req.query.count),
    },
    stock: Number(req.query.stock),
  };
  const prodAdded = addProduct(product);

  if (prodAdded === 1) {
    res.send({
      message: `successfully added ${product.title} to the products`,
      prodId: product.id,
    });
  } else {
    res.send({
      message: `failed to add ${product.title} because it is already registered as a product`,
      prodId: "unknown",
    });
  }
});

app.post("/api/products/update-product-stock", (req, res) => {
  const prodId = req.query.id;
  const stockChange = Number(req.query.stockChange);

  const updated = updateProductStock(prodId, stockChange);
  if (updated && updated.success) {
    res.send(`${updated.product} stock updated to ${updated.newStock}`);
  } else if (updated) {
    res.send(
      `cannot update stock of ${updated.product} as you tried to remove ${stockChange} but there are only ${updated.oldStock} remaining`
    );
  } else {
    res.send("product not found");
  }
});

app.post("/api/products/remove-product", (req, res) => {
  const removed = removeProduct(req.query.id);
  if (removed) {
    res.send(`successfully removed ${removed.title}`);
  } else {
    res.send("product not found");
  }
});

app.post("/api/products/add-category", (req, res) => {
  const category = req.query.category;
  const catAdded = addCategory(category);

  if (catAdded === -1) {
    res.send(`failed to add category, ${category} is already a category`);
  } else {
    res.send(`successfully added the ${category} category`);
  }
});

app.post("/api/products/remove-category", (req, res) => {
  const category = req.query.category;
  const removed = removeCategory(category);
  // check if removed returned the removed category
  if (removed === 1) {
    res.send(`successfully removed the ${category} category`);
  } else if (removed === -1) {
    res.send(
      `the ${category} could not be removed because there are still products in the category`
    );
  } else {
    res.send("category not found");
  }
});

app.listen(8080, () => {
  console.log("server listening on port 8080");
});
