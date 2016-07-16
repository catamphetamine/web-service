export default function promisify(action, bind)
{
	return function(...parameters)
	{
		return new Promise(function(resolve, reject)
		{
			parameters.push((error, result) =>
			{
				error ? reject(error) : resolve(result)
			})

			action.apply(bind, parameters)
		})
	}
}