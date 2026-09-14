// Paths declared `select: false` (password hashes, reset tokens, puzzle answers)
// must never be reachable from the query string. Naming one in ?fields= includes
// it, naming its parent includes it as a child, and ?sort= on it leaks its order.
const hiddenPathsOf = (query) => {
  const hidden = [];
  query.model?.schema.eachPath((path, schemaType) => {
    if (schemaType.options?.select === false) hidden.push(path);
  });
  return hidden;
};

const touchesHiddenPath = (field, hiddenPaths) =>
  hiddenPaths.some((hidden) => field === hidden || hidden.startsWith(`${field}.`) || field.startsWith(`${hidden}.`));

// Accepts "a,b" or "a b" with optional "-" prefixes. Drops "+path" tokens and
// anything that reaches a hidden path; exclusion signs are preserved.
const safeFieldList = (raw, hiddenPaths) =>
  String(raw)
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((token) => !token.startsWith("+"))
    .filter((token) => !touchesHiddenPath(token.replace(/^-/, ""), hiddenPaths));

class ApiFeatures {
  constructor(mongooseQuery, queryString) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
    this.hiddenPaths = hiddenPathsOf(mongooseQuery);
  }

  filter() {
    const queryObj = { ...this.queryString };

    const excludedFields = ["sort", "limit", "fields", "page"];

    excludedFields.forEach((el) => delete queryObj[el]);

    let newObj = {};
    for (let key in queryObj) {
      if (touchesHiddenPath(key, this.hiddenPaths)) continue;
      if (queryObj[key] && typeof queryObj[key] === "object" && !Array.isArray(queryObj[key])) {
        newObj[key] = {};
        for (let value in queryObj[key]) {
          newObj[key][`$${value}`] = queryObj[key][value];
        }
      } else {
        newObj[key] = queryObj[key];
      }
    }

    // Services scope their base query to what the caller may see, e.g.
    // Task.find({ studentProfileId: ownProfile }). Query#find() would MERGE the
    // caller's filter into that scope, and a plain value on the same key
    // replaces it — ?studentProfileId=<anyone> would then return anyone's data.
    // Nesting the caller's filter under $and means it can only narrow the scope.
    if (Object.keys(newObj).length > 0) {
      this.mongooseQuery = this.mongooseQuery.and([newObj]);
    }

    return this;
  }

  sort() {
    const sortby = this.queryString.sort ? safeFieldList(this.queryString.sort, this.hiddenPaths).join(" ") : "";

    if (sortby) {
      this.mongooseQuery = this.mongooseQuery.sort(sortby);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort("-createdAt");
    }

    return this;
  }

  fields() {
    // Hidden fields may only be opted into by services, never by the query string.
    const selectedFields = this.queryString.fields ? safeFieldList(this.queryString.fields, this.hiddenPaths).join(" ") : "";

    if (selectedFields) {
      this.mongooseQuery = this.mongooseQuery.select(selectedFields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select("-__v");
    }
    return this;
  }
  pagination() {
    const page = parseInt(this.queryString.page) || 1;
    const limit = parseInt(this.queryString.limit) || 10;
    const skip = (page - 1) * limit;
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
    return this;
  }
}

export default ApiFeatures;
