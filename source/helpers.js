// // if the variable is defined
export const exists = what => typeof what !== 'undefined'

// used for JSON object type checking
const object_constructor = {}.constructor

// detects a JSON object
export function is_object(object)
{
	return exists(object) && (object !== null) && object.constructor === object_constructor
}

// extends the first object with 
/* istanbul ignore next: some weird transpiled code, not testable */
export function extend(...objects)
{
	objects = objects.filter(x => exists(x))

	if (objects.length === 0)
	{
		return
	}
	
	if (objects.length === 1)
	{
		return objects[0]
	}

	const to   = objects[0]
	const from = objects[1]

	if (objects.length > 2)
	{
		const last = objects.pop()
		const intermediary_result = extend.apply(this, objects)
		return extend(intermediary_result, last)
	}

	for (let key of Object.keys(from))
	{
		if (is_object(from[key]))
		{
			if (!is_object(to[key]))
			{
				to[key] = {}
			}

			extend(to[key], from[key])
		}
		else if (Array.isArray(from[key]))
		{
			if (!Array.isArray(to[key]))
			{
				to[key] = []
			}

			to[key] = to[key].concat(clone(from[key]))
		}
		else
		{
			to[key] = from[key]
		}
	}

	return to
}
