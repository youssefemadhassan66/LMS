
class ApiFeatures {
    constructor(mongooseQuery,queryString) {
        this.mongooseQuery  = mongooseQuery;
        this.queryString = queryString;
    }

    filter(){
        const queryObj = {...this.queryString}

        const excludedFields = ['sort','limit','fields',"page"];

        excludedFields.forEach(el=> delete queryObj[el]);

        let newObj = {}
        for(let key in queryObj){
            if (queryObj[key] && typeof queryObj[key] === 'object' && !Array.isArray(queryObj[key])){
                newObj[key]={}
                for(let value in queryObj[key])
                {
                    newObj[key][`$${value}`] = queryObj[key][value];
                }
            }
            else {
                newObj[key] = queryObj[key]
            }
        }

        this.mongooseQuery = this.mongooseQuery.find(newObj);

        return this;

    }


  sort() {
        if (this.queryString.sort) {
            const sortby = this.queryString.sort.split(',').join(' ');
            this.mongooseQuery = this.mongooseQuery.sort(sortby);
        } else {
            this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
        }

        return this;
    }

    fields(){
        if(this.queryString.fields){
            const selectedFields = this.queryString.fields.split(',').join(' ')
            this.mongooseQuery = this.mongooseQuery.select(selectedFields)
        }
        else {
        this.mongooseQuery = this.mongooseQuery.select('-__v');
        }
        return this;

    }
    pagination(){
        const page = parseInt(this.queryString.page) || 1;
        const limit = parseInt(this.queryString.limit) || 10;
        const skip = (page-1) * limit;
        this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
        return this; 
    }
}

export default ApiFeatures